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
