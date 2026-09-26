# PersonalHub production runtime

Phase 2B runs PostgreSQL and PersonalHub privately and uses a remotely managed Cloudflare Tunnel as the only Internet-facing connector. The production owner is initialized, real product data is present, and Phase 2B.5 provides daily off-host PostgreSQL backups. CI/CD remains deferred. No service publishes a host port, and the AWS security group retains zero ingress rules.

## Private Compose architecture

The static Compose definition is managed by Ansible at `/opt/personalhub/compose/compose.production.yml`. It creates:

- `postgres`: the pinned official PostgreSQL 16 ARM64 image, backed by the named volume `personalhub-production-postgres-data`;
- `app`: an immutable PersonalHub ECR image selected by deployment-owned release metadata;
- `cloudflared`: the pinned official ARM64 connector image for the remotely managed `personalhub-prod` tunnel;
- `personalhub-production-backend`: an internal Docker network shared by PostgreSQL, PersonalHub, and cloudflared;
- `personalhub-production-edge`: an egress-capable Docker network attached only to cloudflared.

PostgreSQL listens only inside the backend network as `postgres:5432`. PersonalHub listens only inside that network as `app:3000`. Neither service joins the edge network. Cloudflared is the sole dual-homed connector: it receives requests over outbound tunnel connections on the edge network and forwards them to `http://app:3000` over the internal backend. There are no host mappings for 3000, 3001, 3002, or 5432, and no AWS inbound application rule.

All three services use `restart: unless-stopped`. Docker therefore restarts them after Docker daemon or host recovery unless an operator deliberately stopped them. Deployment and verification use Systems Manager; SSH remains disabled.

## Secrets and release identity

`/usr/local/sbin/personalhub-materialize-runtime-env` retrieves only `/personalhub/production/postgres/password` through the EC2 instance role. It validates the expected URL-safe format, constructs the PostgreSQL URL in process memory, and atomically writes `/etc/personalhub/runtime.env` as `root:root` mode `0600`.

`/usr/local/sbin/personalhub-materialize-cloudflared-token` independently retrieves only `/personalhub/production/cloudflare/tunnel-token` and atomically writes `/etc/personalhub/cloudflared-token` as `root:root` mode `0600`. Compose mounts that dedicated file read-only only into cloudflared and invokes the official `--token-file` interface, so the token is not placed in general Compose environment metadata or exposed to the application or PostgreSQL. The official image normally runs as an unprivileged UID; this service runs as container root solely because the required host file is root-owned mode `0600`, while retaining a read-only filesystem, all capabilities dropped, and `no-new-privileges`.

The non-secret `/etc/personalhub/release.env` contains the exact immutable ECR image reference. Ansible intentionally does not manage this file so future CI/CD can own release selection without changing static host configuration. `/usr/local/sbin/personalhub-compose` combines the release and runtime files for root-only Compose operations.

Compose injects the PostgreSQL password and application database URL into container environments. Docker stores configured environment values in container metadata, so root and members of the root-equivalent `docker` group can inspect them. Mode `0600`, SSM-only administration, a locked runtime account, and tightly limited operator access are the current boundary; this is not equivalent to a dedicated runtime secrets service.

## Migration and startup lifecycle

On an empty first production database:

1. authenticate to ECR with `/usr/local/sbin/personalhub-ecr-login`;
2. materialize the PostgreSQL runtime environment;
3. write the reviewed immutable app image to `/etc/personalhub/release.env`;
4. pull the PostgreSQL and PersonalHub images;
5. start only PostgreSQL and verify it is healthy and empty;
6. run `npx prisma migrate deploy` as a one-off app container;
7. start PersonalHub and verify private health;
8. materialize the Cloudflare Tunnel token independently;
9. pull the pinned cloudflared image;
10. validate the connector credential with a one-shot, no-restart container;
11. start cloudflared only after validation succeeds.

The application image entrypoint also runs `prisma migrate deploy` before `npm start`. This repeat is deliberately idempotent and prevents a normal restart from serving against an older schema. Never run `migrate dev`, seeds, or owner bootstrap as part of deployment. Production now contains the manually bootstrapped owner and the selectively migrated PersonalHub product dataset recorded in `docs/PRODUCTION-DATA-MIGRATION-2026-09-26.md`.

## Private verification

Health checks run inside containers or the Docker network; they do not require a temporary host port:

```text
sudo /usr/local/sbin/personalhub-compose ps
sudo /usr/local/sbin/personalhub-compose exec -T app \
  node -e "fetch('http://localhost:3000/api/health').then(async r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
```

Verify that `ss -H -lntup` has no listeners on 3000, 3001, 3002, or 5432 and that the EC2 security group still has zero ingress. The production login page should recognize that the owner is initialized; owner changes remain a separate manual security operation.

## Tunnel and public verification

The tunnel is remotely managed in Cloudflare. The live public hostname is `personalhub.studexhub.com`, and its origin service is `http://app:3000`. Cloudflare dashboard configuration owns that hostname-to-origin route; the tunnel token is a connector credential, not a management API credential.

Cloudflared's local readiness check confirms registered tunnel connections. Internal health remains the application container's request to `http://localhost:3000/api/health`; public health is independently checked at `https://personalhub.studexhub.com/api/health`. Stopping cloudflared should interrupt only public ingress while the private application and PostgreSQL remain healthy; `restart: unless-stopped` restores the connector after an explicit start or host recovery. Docker health status is observational: `unless-stopped` restarts a process that exits, but it does not restart a still-running unhealthy process. Operator verification must therefore treat an unhealthy connector as an incident rather than assuming Docker will recycle it.

The named PostgreSQL volume must never be deleted during routine deployment. Schema persistence is verified by restarting PostgreSQL and confirming the migration table and application health remain intact. Require a current, verified off-host backup before every destructive database operation.

## Scheduled PostgreSQL backups

Ansible installs a root-owned backup helper at `/usr/local/sbin/personalhub-postgres-backup` and manages these systemd units:

- `personalhub-postgres-backup.service`: hardened one-shot backup execution;
- `personalhub-postgres-backup.timer`: daily scheduling with `Persistent=true`.

The timer runs at `19:30 UTC`, which is `03:30 Asia/Kuala_Lumpur` on the following local calendar day. The host remains on UTC. A missed run caused by host downtime is started after the timer becomes active again.

Each run executes `pg_dump -Fc` inside the production PostgreSQL container over its local Unix socket. It does not stop PostgreSQL or expose a password or database URL. The helper validates the custom archive with `pg_restore --list`, computes SHA-256, and uploads a uniquely timestamped object to:

`s3://personalhub-production-210855481769-pg-backups/postgresql/scheduled/`

The SHA-256 value is retained as S3 object metadata and as the native S3 SHA-256 checksum. The helper verifies object size, encryption, metadata, and checksum before reporting success. Its protected workspace is `/opt/personalhub/backups/scheduled-work` (`root:root`, mode `0700`); temporary archives are removed on success and failure. A non-blocking lock rejects overlapping executions. Uploads use S3's `If-None-Match: *` precondition, so even a timestamp collision cannot replace a prior backup.

Run and inspect backups without exposing database credentials:

```text
sudo systemctl start personalhub-postgres-backup.service
sudo systemctl status personalhub-postgres-backup.service
systemctl list-timers personalhub-postgres-backup.timer
sudo journalctl -u personalhub-postgres-backup.service
```

Ansible convergence installs and enables the static mechanism but never invokes a backup. The EC2 instance role supplies S3 access; no static AWS credentials exist on the host. It can list, upload, and read `postgresql/*` objects and abort multipart uploads, but it cannot delete completed backups. Retention remains controlled by the Terraform-managed S3 lifecycle: current objects expire after approximately 90 days, noncurrent versions after approximately 30 days, and incomplete multipart uploads after seven days.

## Disaster recovery

There is no automatic production restore. A reviewed disaster-recovery operation should:

1. select a verified custom-format object from `postgresql/scheduled/`;
2. verify its recorded SHA-256 metadata and archive table of contents;
3. restore it first into an isolated PostgreSQL 16 container and disposable volume;
4. compare all application-table counts, deterministic row fingerprints, migrations, owner state, and foreign-key integrity;
5. stop the production app before any separately authorized production restore;
6. restore using `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges` through an approved operational procedure;
7. restart and verify database, application, tunnel, login, and public health.

Never reuse or delete `personalhub-production-postgres-data` during a rehearsal. Never connect a disposable recovery app to production PostgreSQL. The first successful full restore rehearsal is recorded in `docs/PRODUCTION-RESTORE-REHEARSAL-2026-09-26.md`.
