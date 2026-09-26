# PersonalHub production runtime

Phase 2B.4 runs PostgreSQL and PersonalHub privately and uses a remotely managed Cloudflare Tunnel as the only Internet-facing connector. Owner bootstrap, backup scheduling, and CI/CD remain deferred. No service publishes a host port, and the AWS security group retains zero ingress rules.

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

The application image entrypoint also runs `prisma migrate deploy` before `npm start`. This repeat is deliberately idempotent and prevents a normal restart from serving against an older schema. Never run `migrate dev`, seeds, or owner bootstrap as part of deployment. There was no pre-existing production data before the initial Phase 2B.3 migration.

## Private verification

Health checks run inside containers or the Docker network; they do not require a temporary host port:

```text
sudo /usr/local/sbin/personalhub-compose ps
sudo /usr/local/sbin/personalhub-compose exec -T app \
  node -e "fetch('http://localhost:3000/api/health').then(async r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
```

Verify that `ss -H -lntup` has no listeners on 3000, 3001, 3002, or 5432 and that the EC2 security group still has zero ingress. The login page should state that the owner is not initialized until the separate manual bootstrap phase is authorized.

## Tunnel and public verification

The tunnel is remotely managed in Cloudflare. The intended public hostname is `personalhub.studexhub.com`, and its origin service is `http://app:3000`. Cloudflare dashboard configuration owns that hostname-to-origin route; the tunnel token is a connector credential, not a management API credential. A healthy connector does not create the route by itself. Until the dashboard route exists, DNS and public HTTPS remain intentionally unavailable while the private runtime stays healthy.

Cloudflared's local readiness check confirms registered tunnel connections. Internal health remains the application container's request to `http://localhost:3000/api/health`; public health is independently checked at `https://personalhub.studexhub.com/api/health`. Stopping cloudflared should interrupt only public ingress while the private application and PostgreSQL remain healthy; `restart: unless-stopped` restores the connector after an explicit start or host recovery. Docker health status is observational: `unless-stopped` restarts a process that exits, but it does not restart a still-running unhealthy process. Operator verification must therefore treat an unhealthy connector as an incident rather than assuming Docker will recycle it.

The owner intentionally remains uninitialized after tunnel activation. Manual owner bootstrap is the next deliberate production operation; it is never part of Compose startup or tunnel configuration.

The named PostgreSQL volume must never be deleted during routine deployment. Schema persistence is verified by restarting PostgreSQL and confirming the migration table and application health remain intact. Backup automation is deferred; before future migrations on a database containing real data, require a verified off-host backup.
