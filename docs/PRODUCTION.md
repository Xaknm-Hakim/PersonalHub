# PersonalHub production runtime

Phase 2B.3 runs only PostgreSQL and PersonalHub on the production EC2 host. Cloudflare Tunnel, public hostname routing, owner bootstrap, backup scheduling, and CI/CD remain deferred. Neither service publishes a host port, and the AWS security group retains zero ingress rules.

## Private Compose architecture

The static Compose definition is managed by Ansible at `/opt/personalhub/compose/compose.production.yml`. It creates:

- `postgres`: the pinned official PostgreSQL 16 ARM64 image, backed by the named volume `personalhub-production-postgres-data`;
- `app`: an immutable PersonalHub ECR image selected by deployment-owned release metadata;
- `personalhub-production-backend`: an internal Docker network shared only by these services.

PostgreSQL listens only inside the Compose network as `postgres:5432`. PersonalHub listens only inside that network as `app:3000`. There are no host mappings for 3000, 3001, 3002, or 5432. A future cloudflared service may join the internal network while using a separate egress-capable network, but Phase 2B.3 does not install or start it.

Both services use `restart: unless-stopped`. Docker therefore restarts them after Docker daemon or host recovery unless an operator deliberately stopped them. Deployment and verification use Systems Manager; SSH remains disabled.

## Secrets and release identity

`/usr/local/sbin/personalhub-materialize-runtime-env` retrieves only `/personalhub/production/postgres/password` through the EC2 instance role. It validates the expected URL-safe format, constructs the PostgreSQL URL in process memory, and atomically writes `/etc/personalhub/runtime.env` as `root:root` mode `0600`. It never retrieves the Cloudflare token.

The non-secret `/etc/personalhub/release.env` contains the exact immutable ECR image reference. Ansible intentionally does not manage this file so future CI/CD can own release selection without changing static host configuration. `/usr/local/sbin/personalhub-compose` combines the release and runtime files for root-only Compose operations.

Compose injects the PostgreSQL password and application database URL into container environments. Docker stores configured environment values in container metadata, so root and members of the root-equivalent `docker` group can inspect them. Mode `0600`, SSM-only administration, a locked runtime account, and tightly limited operator access are the current boundary; this is not equivalent to a dedicated runtime secrets service.

## Migration and startup lifecycle

On an empty first production database:

1. authenticate to ECR with `/usr/local/sbin/personalhub-ecr-login`;
2. materialize the runtime environment;
3. write the reviewed immutable app image to `/etc/personalhub/release.env`;
4. pull both images;
5. start only PostgreSQL and verify it is healthy and empty;
6. run `npx prisma migrate deploy` as a one-off app container;
7. start PersonalHub.

The application image entrypoint also runs `prisma migrate deploy` before `npm start`. This repeat is deliberately idempotent and prevents a normal restart from serving against an older schema. Never run `migrate dev`, seeds, or owner bootstrap as part of deployment. There was no pre-existing production data before the initial Phase 2B.3 migration.

## Private verification

Health checks run inside containers or the Docker network; they do not require a temporary host port:

```text
sudo /usr/local/sbin/personalhub-compose ps
sudo /usr/local/sbin/personalhub-compose exec -T app \
  node -e "fetch('http://localhost:3000/api/health').then(async r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
```

Verify that `ss -H -lntup` has no listeners on 3000, 3001, 3002, or 5432 and that the EC2 security group still has zero ingress. The login page should state that the owner is not initialized until the separate manual bootstrap phase is authorized.

The named PostgreSQL volume must never be deleted during routine deployment. Schema persistence is verified by restarting PostgreSQL and confirming the migration table and application health remain intact. Backup automation is deferred; before future migrations on a database containing real data, require a verified off-host backup.
