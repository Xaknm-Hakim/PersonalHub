# Testing

Run every gate from a prepared overhaul environment:

```bash
npm test
npm run test:integration
npm run test:browser
npm run lint
npm run typecheck
npm run format:check
npm run prisma:validate
npm run prisma:generate
npm run build
```

`npm test` runs unit tests only and excludes `*.integration.test.ts` files.

`npm run test:integration` starts uniquely named PostgreSQL Docker containers bound only to loopback, generates transient credentials, applies migrations, and removes its containers and volumes afterward. The runner deletes normal database environment variables and refuses to use the Compose, legacy, or another non-temporary database. It requires Docker; never substitute a configured user database when Docker is unavailable.

`npm run test:browser` creates another disposable PostgreSQL runtime, builds and starts the production application on an ephemeral loopback port, and drives it with the project-local Playwright dependency. The smoke covers repeated quick capture, task create/edit/validation/complete/delete, visible mutation outcomes, tags and relationships, missing items, API health, Calendar/Timeline, theme, and mobile layout. Navigation waits use exact route/UI outcomes; there are no arbitrary sleeps or full-page reload workarounds.

Manual acceptance checks are in [ACCEPTANCE_TESTS.md](./ACCEPTANCE_TESTS.md). Documentation is not evidence of a pass; retain actual command output in the validation handoff.
