import { disposableDatabase } from "./disposable-database";
const target = disposableDatabase();
if (process.env.PERSONALHUB_TEST_RUNNER_TOKEN !== target.token) {
  throw new Error(
    "Refusing integration tests: run them through scripts/test-integration.ts."
  );
}
// Runs before application modules instantiate Prisma. Discard every normal URL.
delete process.env.DATABASE_URL;
process.env.PERSONALHUB_DATABASE_URL = target.url;
