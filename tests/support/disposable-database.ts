type Environment = Record<string, string | undefined>;
/** Pure preflight: no application URL fallback, connection, or dotenv loading. */
export function disposableDatabase(env: Environment = process.env) {
  const reject = () => {
    throw new Error(
      "Refusing destructive tests: explicit local disposable database, confirmation and ownership token required."
    );
  };
  if (env.NODE_ENV !== "test" || !env.PERSONALHUB_TEST_DATABASE_URL)
    return reject();
  let url: URL;
  try {
    url = new URL(env.PERSONALHUB_TEST_DATABASE_URL);
  } catch {
    return reject();
  }
  const name = url.pathname.slice(1);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^personalhub_test_[a-z0-9_]+$/.test(name) ||
    name.length > 63 ||
    url.hash ||
    [...url.searchParams].some(
      ([key, value]) => key !== "schema" || value !== "public"
    ) ||
    env.PERSONALHUB_TEST_CONFIRM !== name ||
    !/^[a-f0-9]{32,}$/.test(env.PERSONALHUB_TEST_TOKEN ?? "")
  )
    return reject();
  return { name, url: url.toString(), token: env.PERSONALHUB_TEST_TOKEN! };
}

/** Must run immediately before any table-wide cleanup; marker is provisioned by the disposable runner only. */
export async function assertDisposableDatabase(
  query: (sql: string) => Promise<unknown>,
  env: Environment = process.env
) {
  const target = disposableDatabase(env);
  const rows = await query(
    "SELECT current_database() AS name, token FROM public._personalhub_test_owner"
  );
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    rows[0].name !== target.name ||
    rows[0].token !== target.token
  )
    throw new Error(
      "Refusing cleanup: database ownership marker does not match this test run."
    );
}
