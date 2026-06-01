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

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

The theme toggle in the main navigation switches between light and dark mode. The selected theme is saved in `localStorage`; without a saved choice, the app follows the system preference.

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
