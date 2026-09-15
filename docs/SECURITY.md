# PersonalHub security model

PersonalHub is a single-owner service. It has no registration, account discovery, roles, organizations, or public data routes. Browser pages are grouped behind one owner-session layout; `/login` and `/api/health` are the only deliberately public application surfaces. Every `/api/v1/*` route requires a bearer token.

## Owner bootstrap

The owner is created once by a server-side command. The command rejects passwords shorter than 12 or longer than 1024 characters, refuses to overwrite the fixed `owner` record, and never prints the password.

For a local source checkout, enter the value without placing it in shell history:

```bash
read -rsp 'Owner password: ' PERSONALHUB_OWNER_PASSWORD; printf '\n'
export PERSONALHUB_OWNER_PASSWORD
npx dotenv -e .env.overhaul -- npm run owner:bootstrap
unset PERSONALHUB_OWNER_PASSWORD
```

Running the command again is safe: it reports that the owner exists and changes nothing. Do not retain `PERSONALHUB_OWNER_PASSWORD` in a production environment file. For the Compose app, pass the temporary variable to `docker compose exec` after migrations have run.

There is no public registration or bootstrap HTTP endpoint.

## Password and session cryptography

Passwords use Node's built-in scrypt implementation with a random 128-bit salt, `N=32768`, `r=8`, `p=1`, a 64-byte derived key, and a 64 MiB memory ceiling. The encoded database value contains the algorithm parameters, salt, and derived key, never the password. This implementation has no native npm add-on and works on Node-supported ARM64 systems.

Successful login creates an opaque 256-bit random `phs1.<secret>` credential. The browser receives it only in an HttpOnly, `SameSite=Strict`, path-wide cookie. Production cookies are `Secure` and use the `__Host-` prefix; therefore production browser access must use HTTPS. Only SHA-256 digests of session credentials are stored in PostgreSQL.

Sessions have a 30-day absolute lifetime and do not slide. Activity is recorded at most hourly but does not extend expiration. Multiple devices can hold independent sessions. Logout deletes the current database session and expires its cookie. Expired sessions and sessions whose stored authentication version differs from the owner's version are rejected and removed lazily. A future password-change operation must increment `Owner.authVersion` to invalidate every existing session; no password-change or recovery UI exists yet.

## Login abuse controls

Failed login attempts are persisted in PostgreSQL under a SHA-256 client key. Five failures inside 15 minutes produce a five-minute block. A successful login clears that key. This is temporary throttling, not a permanent lockout. Without proxy trust, the single direct-service key is used. With `PERSONALHUB_TRUST_PROXY=true`, the first `X-Forwarded-For` value is used; enable this only when the trusted ingress overwrites forwarded headers.

Login success, failure, throttling, logout, API-token creation/revocation, API authentication failures, health failures, and safe server-error categories are emitted as one-line JSON. Passwords, bearer credentials, session cookies, request bodies, database URLs, and error messages are not logged.

## API tokens

Settings lets the authenticated owner create, list, and revoke API tokens. A token has a name, `read` and/or `write` scopes, creation time, optional expiry, last-used time, and revocation time. The default UI expiry is 90 days.

Credentials use this format:

```text
phv1.<96-bit-public-id>.<256-bit-secret>
```

The plaintext is returned to the owner once after creation. Lists never contain it. PostgreSQL stores the public ID and a SHA-256 digest of the high-entropy secret. Verification performs a timing-safe digest comparison for a located public ID. Unknown, malformed, expired, and revoked credentials all receive the same vague `401` response. A known token lacking a required scope receives `403 INSUFFICIENT_SCOPE`.

Send credentials as:

```text
Authorization: Bearer phv1....
```

The API never accepts browser-session cookies as API authentication. `read` protects GET endpoints; `write` protects create, update, capture, and completion endpoints.

## Browser authorization and CSRF

Every current product page lives in the protected route group and revalidates the database-backed session during server rendering. Every Server Action calls the centralized owner-action guard before mutation logic. Hiding a control is never the authorization boundary.

Next.js Server Action Origin/Host enforcement remains enabled. The application additionally requires an exact HTTP(S) Origin/Host match in every browser action, including login. A trusted forwarded host is considered only when `PERSONALHUB_TRUST_PROXY=true`. API bearer requests are not subjected to browser CSRF checks.

Server Action bodies and API JSON bodies are limited to 64 KiB. JSON mutation routes require an `application/json` or `application/*+json` content type. Invalid JSON, IDs, validation, media type, payload size, authentication, authorization, not-found, and internal failures use structured non-secret responses.

## Response headers and CORS

A request nonce is generated by `proxy.ts` and propagated to Next.js. The CSP permits same-origin resources, nonce-bearing scripts with `strict-dynamic`, same-origin connections, no objects, no framing, and same-origin forms. Inline styles remain allowed because the existing UI uses them; inline scripts are not generally allowed. Development additionally permits `unsafe-eval` for Next tooling.

All application responses receive CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, and frame denial. HSTS and `upgrade-insecure-requests` are emitted only when production is actually reached over HTTPS (directly or through an explicitly trusted proxy), so local production-mode HTTP is not pinned.

CORS is intentionally disabled. Quickshell and other native HTTP clients do not use the browser same-origin model. A future browser client on another origin must add an explicit allowlist rather than `*`.

## Environment variables

All current variables are server-only; none use `NEXT_PUBLIC_*`.

| Variable                        | Classification        | Purpose                                                                 |
| ------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `PERSONALHUB_DATABASE_URL`      | secret                | PostgreSQL runtime connection; required and validated in production     |
| `PERSONALHUB_POSTGRES_PASSWORD` | secret                | Local Compose PostgreSQL initialization                                 |
| `PERSONALHUB_OWNER_PASSWORD`    | bootstrap-only secret | Temporary input to owner bootstrap; unset immediately afterward         |
| `PERSONALHUB_TRUST_PROXY`       | server configuration  | Trust ingress-provided host/protocol/client forwarding only when `true` |
| `PERSONALHUB_TIME_ZONE`         | server configuration  | Planning-date timezone                                                  |

`.env` and `.env.overhaul` are ignored. `.env.example` contains placeholders only. Do not bake real values into an image, build arguments, client variables, or logs. PostgreSQL URL validation fails a production process before Prisma client use when the URL is missing, malformed, non-PostgreSQL, or lacks credentials.

## Health and errors

`GET /api/health` performs a minimal database readiness query and returns only `{ "status": "ok" }`, or a non-sensitive `503` body. It is public so container and deployment health checks do not need a long-lived token. The route exposes no database version, host, schema, timings, or credentials.

The App Router error boundary gives browser users a generic retry UI. API errors never serialize raw Prisma errors or stack traces. Operational logs retain only an event name and safe error type.

## Database privileges

The runtime application does not need PostgreSQL superuser, role-management, database-creation, or server-administration privileges. Where deployment orchestration can supply separate credentials, production should use:

- a migration role that owns the application schema and runs `prisma migrate deploy` during a controlled release; and
- a runtime role with connect/schema usage and CRUD/sequence privileges on PersonalHub tables only.

The current Compose stack uses one local role for both jobs, and the shipped container entrypoint runs `prisma migrate deploy` before starting Next.js. A production deployment using that entrypoint therefore needs one non-superuser role that owns or can migrate the application schema as well as perform runtime CRUD. To enforce a narrower runtime role, run migrations separately with the migration credential and start the image with `npm start` under the runtime credential instead of using the migration-running entrypoint; that orchestration belongs to the deferred deployment phase. Production connection strings remain server-only. Archived seed code remains disconnected from package and Make targets, and all destructive automated tests retain disposable-database ownership checks.

## Dependency and ARM64 review

As of 2026-09-15, `npm audit --omit=dev` reports zero production/runtime vulnerabilities. The full development-tree audit reports five vulnerable packages (three moderate, one high, one critical), all under Vitest/Vite/esbuild. The critical Vitest advisory requires its optional UI server to be listening; PersonalHub invokes bounded `vitest run` jobs and does not ship or start Vitest in application runtime. Remediation currently requires a Vitest major upgrade, so it is deferred rather than mixed into this hardening change. Reassess it when updating the test toolchain.

Authentication uses Node's portable built-in crypto rather than a native password add-on. The official Node 22, PostgreSQL 16, Prisma, and Playwright packages publish Linux ARM64 support. Record whether a cross-platform image was actually built in the release verification report; package inspection alone is not an executed ARM64 build.

## Known limitations

- There is no owner password-change, recovery, or device-session management UI.
- Expired session and throttle-row cleanup is lazy; no scheduled maintenance job exists.
- Login throttling is application/database based, not a distributed edge defense.
- API scopes are intentionally only `read` and `write`.
- CSP still permits inline styles for compatibility with the current UI.
- Cross-origin browser API clients are unsupported until an explicit CORS allowlist is designed.
- Proxy trust is safe only when the ingress strips and rewrites forwarded headers.
