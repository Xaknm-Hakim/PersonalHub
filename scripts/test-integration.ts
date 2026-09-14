/**
 * Starts a one-run PostgreSQL instance for integration tests.  It deliberately
 * never reads DATABASE_URL, PERSONALHUB_DATABASE_URL, .env, or compose config.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const root = process.cwd();
const suffix = `${process.pid}_${randomBytes(8).toString("hex")}`;
const database = `personalhub_test_${suffix}`;
const container = `personalhub-test-${suffix}`;
const volume = `personalhub-test-${suffix}`;
const password = randomBytes(24).toString("hex");
const token = randomBytes(32).toString("hex");
let started = false;

function run(command: string, args: string[], env = process.env) {
  return execFileSync(command, args, {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
function cleanup() {
  if (!started) return;
  // Guard cleanup even though names are random: never remove a container/volume
  // unless it has this run's disposable-test identity.
  const label = spawnSync(
    "docker",
    [
      "inspect",
      "-f",
      '{{ index .Config.Labels "personalhub.disposable-test" }}',
      container
    ],
    { encoding: "utf8" }
  );
  if (label.status !== 0 || label.stdout.trim() !== "true")
    throw new Error(
      "Refusing cleanup: disposable container ownership label is missing."
    );
  const volumeLabel = spawnSync(
    "docker",
    [
      "volume",
      "inspect",
      "-f",
      '{{ index .Labels "personalhub.disposable-test" }}',
      volume
    ],
    { encoding: "utf8" }
  );
  if (volumeLabel.status !== 0 || volumeLabel.stdout.trim() !== "true")
    throw new Error(
      "Refusing cleanup: disposable volume ownership label is missing."
    );
  try {
    spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  } finally {
    spawnSync("docker", ["volume", "rm", volume], { stdio: "ignore" });
    started = false;
  }
}
function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = spawnSync(
      "docker",
      [
        "exec",
        container,
        "pg_isready",
        "-U",
        "personalhub_test",
        "-d",
        database
      ],
      { stdio: "ignore" }
    );
    if (ready.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}

try {
  // These tests make no connections, so they are safe and prove the guard before Docker work.
  run("npx", ["vitest", "run", "tests/test-database-safety.test.ts"]);
  run("docker", [
    "volume",
    "create",
    "--label",
    "personalhub.disposable-test=true",
    volume
  ]);
  run("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "--label",
    "personalhub.disposable-test=true",
    "-e",
    "POSTGRES_USER=personalhub_test",
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-e",
    `POSTGRES_DB=${database}`,
    "-v",
    `${volume}:/var/lib/postgresql/data`,
    "-p",
    "127.0.0.1::5432",
    "postgres:16-alpine"
  ]);
  started = true;
  waitForPostgres();
  const mapping = run("docker", ["port", container, "5432/tcp"]);
  const port = /^127\.0\.0\.1:(\d+)$/.exec(mapping)?.[1];
  if (!port)
    throw new Error("Disposable PostgreSQL was not bound to loopback.");
  const url = `postgresql://personalhub_test:${password}@127.0.0.1:${port}/${database}?schema=public`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    PERSONALHUB_TEST_DATABASE_URL: url,
    PERSONALHUB_TEST_CONFIRM: database,
    PERSONALHUB_TEST_TOKEN: token,
    PERSONALHUB_TEST_RUNNER_TOKEN: token
  };
  delete env.DATABASE_URL;
  delete env.PERSONALHUB_DATABASE_URL;
  run("npx", ["prisma", "migrate", "deploy"], {
    ...env,
    PERSONALHUB_DATABASE_URL: url
  });
  run(
    "npx",
    [
      "tsx",
      "-e",
      "import { Client } from 'pg'; (async()=>{const c=new Client({connectionString:process.env.PERSONALHUB_TEST_DATABASE_URL}); await c.connect(); await c.query('CREATE TABLE public._personalhub_test_owner (token text NOT NULL)'); await c.query('INSERT INTO public._personalhub_test_owner (token) VALUES ($1)', [process.env.PERSONALHUB_TEST_TOKEN]); await c.end()})()"
    ],
    env
  );
  run(
    "npx",
    ["vitest", "run", "--config", "vitest.integration.config.ts"],
    env
  );
  console.log("Disposable PostgreSQL integration tests passed.");
} finally {
  cleanup();
}
