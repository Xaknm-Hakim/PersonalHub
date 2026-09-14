# PersonalHub App-Layer Overhaul

Verification date: 2026-09-15 (UTC+08:00)

## 1. Final status

The local app-layer overhaul is complete. PersonalHub now runs on Next.js 16, React 19, Prisma, and PostgreSQL 16. The browser mutation blocker was traced to a Next 15 Server Action Flight payload that completed but intermittently did not commit in the browser. Upgrading to Next 16.3.5 removed the defect without adding reloads, timer sleeps, repeated refreshes, or forced route navigation. Three consecutive strengthened disposable browser runs passed after the upgrade.

The overhaul remains deliberately local-only. Cloud deployment, infrastructure automation, production security, and desktop-shell integration are deferred.

## 2. Architecture

Next.js App Router pages are server-rendered and delegate reads and writes to feature modules under `features/`. Server Actions are thin adapters that validate form input, call services, return structured mutation state, and invalidate the affected route. Shared mutation components preserve invalid input, expose errors, distinguish repeated successful submissions with unique result identities, and avoid full-page reloads.

Prisma targets PostgreSQL only. The production container entrypoint runs `prisma migrate deploy` before `next start`. The isolated Compose project exposes the app at `127.0.0.1:3002` and PostgreSQL at `127.0.0.1:5433`; both services have health checks and persistent data uses a named Docker volume.

The former monolithic `app/actions.ts` has been removed. Domain behavior is organized by task, assignment, project, note, tag, dashboard, calendar, and timeline features. Task Server Actions and `/api/v1` handlers share the same task service.

## 3. UX changes

The responsive application shell and persistent light/dark theme remain. The Dashboard includes quick capture, due and overdue work, and active/developing project summaries. Quick capture supports repeated submissions without remounting or stale success state.

Tasks, assignments, projects, notes, and tags have dedicated forms and list surfaces. Task editing supports repeated saves; invalid submissions retain entered values and show validation feedback. Complete and delete controls show pending state and visible failures. Successful deletion removes the item from the rendered list without `window.location.reload()`.

Search is available across the primary entity pages. Missing edit targets render an explicit not-found state. Calendar and Timeline provide planning views rather than separate sources of truth.

## 4. Domain model and relationships

- Tasks have status, priority, optional planning dates, optional completion timestamp, optional project, and tags.
- Assignments have course metadata, type, status, priority, required deadline, optional start/completion dates, and tags.
- Projects track status, type, priority, planning and completion dates, repository/local/live references, technical context, progress, next action, and lessons learned.
- Notes require title and body and may link to a task, assignment, project, and tags.
- Tags have a unique name, optional color, linked-item counts, and many-to-many relationships with tasks, assignments, and notes.

Planning values are validated `YYYY-MM-DD` calendar dates stored as PostgreSQL `DATE`. Completion timestamps remain instants. Shared closed-status sets keep Dashboard, Calendar, Timeline, task, and assignment behavior consistent.

## 5. PostgreSQL migration and SQLite recovery

`prisma/migrations/20260910113857_init_postgresql/` is the PostgreSQL baseline. Legacy SQLite migrations remain archived separately under `prisma/legacy-sqlite-migrations/` for recovery context.

`scripts/migrate-sqlite-to-postgres.ts` opens SQLite with read-only semantics, validates expected tables and columns, rejects a nonempty PostgreSQL target, imports all entities and join rows in one transaction, validates enum/date/timestamp values, and verifies count, ID, scalar, nullability, date, timestamp, foreign-key, and join parity before commit. A failed verification rolls the transaction back.

The protected snapshot was copied and rehearsed against a fresh disposable PostgreSQL database. Its verified source and target counts were Task 0, Assignment 0, Project 5, Note 0, Tag 5, with all three join tables at 0. All five project IDs and five project rows were preserved. Source-copy SHA parity and SQLite integrity were verified. See `MIGRATION-VERIFICATION.md`.

No import or migration was run against `data/personalhub.db` or the protected snapshot itself.

## 6. API surface

The localhost-only JSON API uses `{ "data": ... }` for success and `{ "error": { "code", "message", "fields"? } }` for failure:

- `GET /api/v1/today`
- `GET /api/v1/upcoming`
- `POST /api/v1/capture`
- `GET|POST /api/v1/tasks`
- `GET|PATCH /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/complete`

Task list filters include status, priority, text query, and tag. Validation failures and missing records are structured and do not expose Prisma internals. The current API is intentionally task-focused; the other entities are available through the web application, not matching public API endpoints.

## 7. Test architecture

`npm test` runs Vitest unit coverage and excludes integration files. `npm run test:integration` creates uniquely named loopback-only PostgreSQL containers with transient credentials, applies migrations, exercises domain mutations and full migration parity/rollback/safety behavior, then removes the containers and volumes. The runner deletes normal database environment variables and refuses non-disposable targets.

`npm run test:browser` builds and starts a production server against another disposable PostgreSQL runtime and drives it with project-local Playwright. The strengthened smoke verifies theme and mobile layout, repeated quick capture, task creation and repeated edit, invalid-input preservation, completion, rendered deletion, tags, relationships, missing-item behavior, Calendar/Timeline, and API health. It waits on exact rendered and navigation outcomes rather than arbitrary sleeps.

## 8. Backup and restore

`scripts/backup-pg.sh` creates a custom-format `pg_dump` archive and validates it with `pg_restore -l` before publishing the file. `scripts/restore-pg.sh` validates before mutation, requires the exact typed database name, takes a safety dump, replaces only the named PostgreSQL database, verifies readiness, and restores the overhaul app only if it was previously running.

The final rehearsal used separate disposable source and target databases. A Task, Project, Tag, and task-tag relationship were dumped and restored with 1/1/1/1 count parity and a matching content fingerprint. A target-only sentinel row was absent after restore, confirming actual replacement. Rehearsal databases and archives were removed afterward.

## 9. Docker runtime and resource baseline

The current source was built into image `sha256:d6fb60da395d4b15999b984021a0bf72ed3707b3ab3b4cbb7baee4ee8a88c91b`. The recreated app reported Next.js 16.3.5, `prisma migrate deploy` found one migration with none pending, and both app and PostgreSQL health checks passed. Main web routes and `/api/v1/today`, `/api/v1/upcoming`, and `/api/v1/tasks` returned HTTP 200.

One idle `docker stats --no-stream` sample after route/API checks measured:

- application: 0.00% CPU, 89.21 MiB
- PostgreSQL: 0.00% CPU, 86.36 MiB
- combined memory: 175.57 MiB

This is a local idle sample, not a production sizing guarantee. No startup memory peak was retained.

## 10. Data safety

Final verification recomputed:

- `data/personalhub.db`: `dc5fd49b957108b9b3aa321854196bd36808c81e92b7b75399e609a6997a9ead`
- `backups/overhaul-safety-20260910-193400/legacy-snapshot.db`: `67e27f14640d0fbb60df0eb246e630c748656aa2185e5efe64d25643044aff00`

Both SQLite files returned `ok` from a read-only `PRAGMA integrity_check`. The legacy `personalhub` container remained running on port 3001 and returned HTTP 200. All destructive verification used disposable PostgreSQL targets.

## 11. Quality gates

The final source is required to pass:

- `npm test`
- `npm run test:integration`
- `npm run test:browser`
- `npm run lint`
- `npm run typecheck`
- `npm run format:check`
- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run build`

The final verification handoff at `/tmp/ph-sol-final.md` records the actual outcomes from the final source state.

## 12. Known limitations

- The application is single-user and localhost-only; there is no production authentication, authorization, TLS, rate limiting, or multi-user isolation.
- PostgreSQL backups are local files unless copied elsewhere.
- The API is task-focused rather than complete CRUD coverage for every entity.
- Resource measurements are idle local samples, not load tests or EC2 recommendations.
- Browser verification uses headless Chromium and is not a cross-browser compatibility matrix.
- `npm audit --omit=dev` reports zero production vulnerabilities. The development-only Vitest 2/Vite toolchain retains five advisories whose npm-proposed fix is the breaking Vitest 5 upgrade; that upgrade is deferred rather than forced into the completed application overhaul.

## 13. Deferred work

Not started in this overhaul: AWS, EC2 sizing/deployment, Terraform, Ansible, CI/CD, production authentication and hardening, Cloudflare deployment, Quickshell integration, and Hyprland changes.
