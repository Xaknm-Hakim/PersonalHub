# PersonalHub

PersonalHub is a local-first personal productivity web app for notes, assignments, tasks, deadlines, and simple timeline planning. It is designed for personal localhost usage, not as a SaaS product.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style local components
- Class-based light/dark mode
- Prisma ORM
- SQLite
- npm
- ESLint / Prettier

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

The SQLite database is stored at `./data/personalhub.db`. Prisma uses `DATABASE_URL="file:../data/personalhub.db"` because SQLite paths are resolved relative to `prisma/schema.prisma`.

Assignments use a practical `type` field such as assignment, exercise, lab, quiz, project, revision, or other. Weight and marks are intentionally not part of the MVP data model.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

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
make db-restore BACKUP=./backups/personalhub-example.db
make status
```

Docker mode is intended for daily local usage at `http://localhost:3001`. npm dev mode is intended for development work at `http://localhost:3000`.

## Docker local usage

Docker runs PersonalHub in production mode for daily localhost usage. The container listens on port `3000`, and Docker Compose exposes it on host port `3001`.

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

Equivalent npm helpers:

```bash
npm run docker:build
npm run docker:up
npm run docker:logs
npm run docker:down
```

The compose file bind-mounts `./data` to `/app/data`, so SQLite persists on the host at `./data/personalhub.db`. Container startup runs `prisma migrate deploy` before `npm start`. It does not seed or delete existing data.

## Local database backups

Create a timestamped local backup of `./data/personalhub.db`:

```bash
npm run db:backup
```

This writes a file like `./backups/personalhub-YYYY-MM-DD-HHMMSS.db`. Backup database files are ignored by Git.

Restore from a backup:

```bash
npm run db:restore -- ./backups/personalhub-example.db
```

The restore script checks that the backup exists, asks you to type `YES`, and creates a safety backup of the current database before overwriting `./data/personalhub.db`. Stop the Docker container first if the app is actively writing to the database:

```bash
npm run docker:down
npm run db:restore -- ./backups/personalhub-example.db
npm run docker:up
```

Backups are local files. Copy important backups to external storage sometimes so they are not lost with the laptop or project folder.

## Build

```bash
npm run lint
npm run build
```

## Database commands

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```
