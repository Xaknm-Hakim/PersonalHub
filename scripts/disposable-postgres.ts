import { spawnSync } from "node:child_process";

interface ReadinessOptions {
  attempts: number;
  retryIntervalMs: number;
  failureMessage: string;
  wait?: (milliseconds: number) => void;
}

interface CommandResult {
  status: number | null;
  stdout?: string;
}

type CommandRunner = (
  command: string,
  args: string[],
  options: { encoding?: "utf8"; stdio?: "ignore" }
) => CommandResult;

const runCommand: CommandRunner = (command, args, options) => {
  const result = spawnSync(command, args, options);
  return {
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : undefined
  };
};

function waitSynchronously(milliseconds: number) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    milliseconds
  );
}

export function waitForReadiness(
  probe: () => boolean,
  options: ReadinessOptions
) {
  const wait = options.wait ?? waitSynchronously;
  for (let attempt = 0; attempt < options.attempts; attempt++) {
    if (probe()) return;
    if (attempt + 1 < options.attempts) wait(options.retryIntervalMs);
  }
  throw new Error(options.failureMessage);
}

export function isDisposablePostgresReady(
  container: string,
  user: string,
  database: string,
  spawn: CommandRunner = runCommand
) {
  // The official image briefly starts an initialization server that can
  // satisfy pg_isready before PID 1 execs the final PostgreSQL server.
  // Require both the final PID 1 process and an accepting database.
  const pidOne = spawn("docker", ["exec", container, "cat", "/proc/1/comm"], {
    encoding: "utf8"
  });
  if (pidOne.status !== 0 || pidOne.stdout?.trim() !== "postgres") return false;

  return (
    spawn(
      "docker",
      ["exec", container, "pg_isready", "-U", user, "-d", database],
      { stdio: "ignore" }
    ).status === 0
  );
}

export function waitForDisposablePostgres(
  container: string,
  user: string,
  database: string
) {
  waitForReadiness(() => isDisposablePostgresReady(container, user, database), {
    attempts: 120,
    retryIntervalMs: 250,
    failureMessage:
      "Disposable PostgreSQL final server did not become ready within 30 seconds."
  });
}
