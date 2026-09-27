import { describe, expect, it, vi } from "vitest";

import {
  isDisposablePostgresReady,
  waitForReadiness
} from "../scripts/disposable-postgres";

describe("disposable PostgreSQL readiness", () => {
  it("rejects the temporary initialization server even when it accepts connections", () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: "docker-entrypoint.sh\n"
    });

    expect(
      isDisposablePostgresReady(
        "disposable-container",
        "test-user",
        "test-database",
        spawn
      )
    ).toBe(false);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("accepts only the final PostgreSQL process with a successful pg_isready probe", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: "postgres\n" })
      .mockReturnValueOnce({ status: 0, stdout: "" });

    expect(
      isDisposablePostgresReady(
        "disposable-container",
        "test-user",
        "test-database",
        spawn
      )
    ).toBe(true);
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      "docker",
      [
        "exec",
        "disposable-container",
        "pg_isready",
        "-U",
        "test-user",
        "-d",
        "test-database"
      ],
      { stdio: "ignore" }
    );
  });

  it("retries until the final PostgreSQL server accepts connections", () => {
    const probe = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const wait = vi.fn<(milliseconds: number) => void>();

    waitForReadiness(probe, {
      attempts: 4,
      retryIntervalMs: 250,
      wait,
      failureMessage: "not ready"
    });

    expect(probe).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenNthCalledWith(1, 250);
    expect(wait).toHaveBeenNthCalledWith(2, 250);
  });

  it("fails clearly after the bounded readiness deadline", () => {
    const probe = vi.fn<() => boolean>().mockReturnValue(false);
    const wait = vi.fn<(milliseconds: number) => void>();

    expect(() =>
      waitForReadiness(probe, {
        attempts: 3,
        retryIntervalMs: 100,
        wait,
        failureMessage: "Disposable PostgreSQL did not become ready."
      })
    ).toThrow("Disposable PostgreSQL did not become ready.");

    expect(probe).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
