/** Runs browser smoke tests against a freshly migrated, disposable PostgreSQL and the current production build. */
import {
  execFileSync,
  spawn,
  spawnSync,
  type ChildProcess
} from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";

const root = process.cwd();
const suffix = `${process.pid}_${randomBytes(8).toString("hex")}`;
const database = `personalhub_test_browser_${suffix}`;
const container = `personalhub-browser-${suffix}`;
const volume = `personalhub-browser-${suffix}`;
const password = randomBytes(24).toString("hex");
let started = false;
let app: ChildProcess | undefined;

function run(command: string, args: string[], env = process.env) {
  return execFileSync(command, args, {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

async function runBrowser(env: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("node", ["scripts/browser-smoke.mjs"], {
      cwd: root,
      env,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Browser smoke exited with ${signal ? `signal ${signal}` : `code ${code}`}.`
          )
        );
    });
  });
}

function cleanup() {
  if (app) {
    app.kill("SIGTERM");
    app = undefined;
  }
  if (!started) return;
  const containerLabel = spawnSync(
    "docker",
    [
      "inspect",
      "-f",
      '{{ index .Config.Labels "personalhub.disposable-test" }}',
      container
    ],
    { encoding: "utf8" }
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
  if (containerLabel.status !== 0 || containerLabel.stdout.trim() !== "true")
    throw new Error(
      "Refusing cleanup: disposable browser container ownership label is missing."
    );
  if (volumeLabel.status !== 0 || volumeLabel.stdout.trim() !== "true")
    throw new Error(
      "Refusing cleanup: disposable browser volume ownership label is missing."
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
    if (
      spawnSync(
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
      ).status === 0
    )
      return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error("Disposable browser PostgreSQL did not become ready.");
}

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("Could not allocate a loopback port."));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForApp(url: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (app?.exitCode !== null)
      throw new Error(
        `Production app exited before readiness (code ${app?.exitCode}).`
      );
    try {
      const response = await fetch(`${url}/api/v1/today`);
      if (response.ok) return;
    } catch {
      // Continue bounded readiness polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Production app did not become ready.");
}

async function main() {
  try {
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
    const postgresPort = /^127\.0\.0\.1:(\d+)$/.exec(mapping)?.[1];
    if (!postgresPort)
      throw new Error(
        "Disposable browser PostgreSQL was not bound to loopback."
      );
    const databaseUrl = `postgresql://personalhub_test:${password}@127.0.0.1:${postgresPort}/${database}?schema=public`;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      PERSONALHUB_DATABASE_URL: databaseUrl,
      NEXT_TELEMETRY_DISABLED: "1"
    };
    delete env.DATABASE_URL;
    run("npx", ["prisma", "migrate", "deploy"], env);
    const port = await freePort();
    const appUrl = `http://127.0.0.1:${port}`;
    const child = spawn(
      "npm",
      ["start", "--", "-p", String(port), "-H", "127.0.0.1"],
      {
        cwd: root,
        env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    app = child;
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    await waitForApp(appUrl);
    try {
      await runBrowser({
        ...env,
        PERSONALHUB_BROWSER_URL: appUrl
      });
    } catch (error) {
      if (stdout.trim()) process.stderr.write(stdout);
      if (stderr.trim()) process.stderr.write(stderr);
      throw error;
    }
    console.log("Disposable production browser smoke tests passed.");
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
