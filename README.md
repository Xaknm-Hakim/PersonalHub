# PersonalHub

PersonalHub is a privately hosted, single-owner personal productivity service for notes, assignments, tasks, projects, deadlines, and simple timeline planning. It is not a multi-user SaaS product.

## Tech stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style local components
- Class-based light/dark mode
- Prisma ORM
- PostgreSQL 16 (isolated local Compose stack)
- npm
- ESLint / Prettier

## Setup

```bash
npm install
./scripts/setup-overhaul-env.sh
npm run prisma:generate
npm run docker:up
```

The setup script creates `.env.overhaul` once with a random URL-safe password and the matching `PERSONALHUB_DATABASE_URL`; it refuses to overwrite an existing file. The canonical local app is `http://127.0.0.1:3002`, and port 3002 is also published on the host's LAN interfaces for mobile reachability testing. PostgreSQL remains bound only to `127.0.0.1:5433`. The legacy SQLite application on port 3001 and its protected snapshots are deliberately separate and are not used, stopped, or changed by overhaul commands. Because Compose runs the hardened production mode, authenticated browser sessions retain Secure cookies: plain HTTP on a LAN IP can verify reachability but must not be used to transmit the owner password or bearer tokens. Full authenticated mobile testing requires an HTTPS endpoint.

Older `.env.overhaul` files may contain only `PERSONALHUB_POSTGRES_PASSWORD`. Do not rerun the setup script or replace that password. Add `PERSONALHUB_DATABASE_URL` using the same existing URL-safe password in this form:

```text
postgresql://personalhub:<same-existing-password>@127.0.0.1:5433/personalhub?schema=public
```

Keep `.env.overhaul` owner-readable only (`chmod 600 .env.overhaul`) because both values are secrets.

After migrations are running, initialize the one owner without placing the password in shell history. In zsh:

```bash
read -rs 'PERSONALHUB_OWNER_PASSWORD?Owner password (12 characters minimum): '; printf '\n'
export PERSONALHUB_OWNER_PASSWORD
npx dotenv -e .env.overhaul -- npm run owner:bootstrap
unset PERSONALHUB_OWNER_PASSWORD
```

The command never prints the password and refuses to replace an existing owner. See [the security model](./docs/SECURITY.md) before any network exposure.

Assignments use a practical `type` field such as assignment, exercise, lab, quiz, project, revision, or other. Weight and marks are intentionally not part of the MVP data model.

Projects are a private project memory and control panel. They track personal, technical, academic, operations, and lab-style projects without GitHub integration, team workflow, Kanban boards, file uploads, or automatic local folder scanning.

Project statuses:

- `planned`: accepted idea, not started yet
- `developing`: actively being built
- `active`: usable, maintained, or currently running
- `paused`: temporarily stopped, may continue later
- `completed`: finished its intended scope
- `archived`: preserved for reference, no longer active
- `abandoned`: intentionally dropped

Project types are `software`, `infrastructure`, `networking`, `cloud`, `academic`, `event_ops`, `lab`, `documentation`, and `other`.

The Dashboard shows a small Projects section with developing/active projects, paused count, recently updated projects, and next actions. Timeline shows projects only when `startDate` exists and either `targetDate` or `completedAt` exists. Calendar shows project target and completed milestones only, not full project duration bars.

## Development

```bash
npm run dev
```

Open `http://localhost:3000` for development, or use the Compose app at `http://127.0.0.1:3002`.

The theme toggle in the main navigation switches between light and dark mode. The selected theme is saved in `localStorage`; without a saved choice, the app follows the system preference.

## Makefile commands

Common commands are available through `make`:

```bash
make help
make dev
make check
make docker-up
make docker-logs
make db-backup
make db-restore BACKUP=./backups/postgres/personalhub-example.dump
make status
```

Docker mode is intended for daily local usage at `http://127.0.0.1:3002`. npm dev mode is intended for development work at `http://localhost:3000`.

## Docker local usage

Docker runs PersonalHub in production mode with a PostgreSQL health check. The container listens on port `3000`, and the isolated Compose project exposes it on host port `3002`.

```bash
docker compose --env-file .env.overhaul -f docker-compose.overhaul.yml up -d --build
docker compose --env-file .env.overhaul -f docker-compose.overhaul.yml logs -f
docker compose --env-file .env.overhaul -f docker-compose.overhaul.yml down
```

Equivalent npm helpers:

```bash
npm run docker:build
npm run docker:up
npm run docker:logs
npm run docker:down
```

Compose uses an isolated named PostgreSQL volume and `restart: unless-stopped` for both services. Container startup runs `prisma migrate deploy` before `npm start`; it never runs seeds or SQLite commands. Consequently, the default entrypoint expects a non-superuser application schema-owner role with migration and runtime privileges. A later production deployment can use separate migration and runtime roles by running migrations as a controlled step and overriding the application command to `npm start`; deployment orchestration is intentionally outside this phase.

## Local database backups

Create a timestamped PostgreSQL backup:

```bash
npm run db:backup
```

This writes a `pg_dump` archive under `./backups/`. Backup archives are ignored by Git.

Restore from a backup:

```bash
npm run db:restore -- ./backups/postgres/personalhub-example.dump
```

The restore script validates the archive, requires `RESTORE personalhub`, creates a verified safety dump, then replaces only the isolated overhaul database. It stops and restarts the overhaul app only when that app was already running; it never addresses the legacy stack. Use a disposable database for rehearsal and do not restore over a populated database unless you explicitly intend that replacement.

```bash
npm run db:restore -- ./backups/postgres/personalhub-example.dump
```

Backups are local files. Copy important backups to external storage sometimes so they are not lost with the laptop or project folder.

## Build

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:browser
```

`npm test` excludes integration files. The integration and browser runners create and remove their own loopback-bound temporary PostgreSQL containers, reject normal database configuration, and must not fall back to any configured local database. Browser smoke builds and starts the production application on an ephemeral loopback port.

## Product and API

Quick capture accepts just a task title (and optionally a due date). Detailed task, assignment, project, and note forms validate server-side, support tags, and link tasks/notes to projects. Tags are managed at `/tags` and can filter tasks and notes.

The versioned API is designed for trusted machine clients and returns `{ "data": ... }` or `{ "error": { "code", "message", "fields" } }`. Create a scoped token in Settings; browser cookies are not API credentials:

```bash
curl http://127.0.0.1:3002/api/v1/today \
  -H "Authorization: Bearer $PERSONALHUB_API_TOKEN"
curl -X POST http://127.0.0.1:3002/api/v1/capture \
  -H "Authorization: Bearer $PERSONALHUB_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"title":"Call dentist","dueDate":"2026-09-12"}'
```

`GET /api/health` is the only public API endpoint and returns a non-sensitive database-readiness status. CORS is intentionally disabled because native clients such as Quickshell do not require it.

Planning dates use validated `YYYY-MM-DD` values and are persisted as PostgreSQL date values at UTC midnight; dates are not client-local instants. Closed status semantics are shared by task, assignment, dashboard, calendar, and timeline queries.

## Database commands

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate -- --name add_change_name
```

The archived seed file is intentionally not wired to an npm or Make command. Do not run it against a working database.

## Reference contracts

- [API contract](./docs/API.md)
- [Domain contract](./docs/DOMAIN.md)
- [Testing and isolation rules](./docs/TESTING.md)
- [Authentication and production security](./docs/SECURITY.md)
- [Manual acceptance checks](./docs/ACCEPTANCE_TESTS.md)
- [Product scope](./docs/PRODUCT_SPEC.md)
- [Overhaul constraints and handoff](./docs/OVERHAUL-REPORT.md)
- [AWS infrastructure and Terraform workflow](./docs/INFRASTRUCTURE.md)
