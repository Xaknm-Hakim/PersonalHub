import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";
const valid = {
  NODE_ENV: "test",
  PERSONALHUB_TEST_DATABASE_URL:
    "postgresql://test:test@127.0.0.1:5433/personalhub_test_abc123",
  PERSONALHUB_TEST_CONFIRM: "personalhub_test_abc123",
  PERSONALHUB_TEST_TOKEN: "0123456789abcdef0123456789abcdef"
};
describe("destructive test safety (no database connection)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("blocks cleanup for absent or incorrect database ownership", async () => {
    for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value);
    for (const rows of [
      [],
      [{ name: "personalhub", token: valid.PERSONALHUB_TEST_TOKEN }],
      [{ name: valid.PERSONALHUB_TEST_CONFIRM, token: "wrong" }]
    ])
      await expect(assertDisposableDatabase(async () => rows)).rejects.toThrow(
        "ownership"
      );
    await expect(
      assertDisposableDatabase(async () => {
        throw new Error("marker absent");
      })
    ).rejects.toThrow("marker absent");
    await expect(
      assertDisposableDatabase(async () => [
        {
          name: valid.PERSONALHUB_TEST_CONFIRM,
          token: valid.PERSONALHUB_TEST_TOKEN
        }
      ])
    ).resolves.toBeUndefined();
  });
  it("never falls back to application database variables", () => {
    expect(() =>
      disposableDatabase({
        DATABASE_URL: valid.PERSONALHUB_TEST_DATABASE_URL,
        PERSONALHUB_DATABASE_URL: valid.PERSONALHUB_TEST_DATABASE_URL
      })
    ).toThrow();
  });
  it("uses the explicit owned target even when ordinary application URLs are present", () => {
    expect(
      disposableDatabase({
        ...valid,
        DATABASE_URL: "postgresql://prod:secret@db.example/personalhub",
        PERSONALHUB_DATABASE_URL:
          "postgresql://prod:secret@db.example/personalhub"
      }).name
    ).toBe(valid.PERSONALHUB_TEST_CONFIRM);
  });
  it("requires every independent opt-in", () => {
    for (const key of Object.keys(valid))
      expect(() =>
        disposableDatabase({ ...valid, [key]: undefined })
      ).toThrow();
  });
  it("rejects populated names, remote hosts, alternate schemas and malformed URLs", () => {
    for (const url of [
      "postgresql://test:test@localhost/personalhub",
      "postgresql://test:test@remote.test/personalhub_test_abc123",
      valid.PERSONALHUB_TEST_DATABASE_URL + "?schema=other",
      "file:../data/personalhub.db"
    ])
      expect(() =>
        disposableDatabase({ ...valid, PERSONALHUB_TEST_DATABASE_URL: url })
      ).toThrow();
  });
  it("rejects mismatched confirmation and non-test environment", () => {
    expect(() =>
      disposableDatabase({ ...valid, PERSONALHUB_TEST_CONFIRM: "yes" })
    ).toThrow();
    expect(() =>
      disposableDatabase({ ...valid, NODE_ENV: "production" })
    ).toThrow();
  });
  it("accepts only explicit local disposable targets", () =>
    expect(disposableDatabase(valid).name).toBe("personalhub_test_abc123"));
  it("never removes an environment file after losing an exclusive-create race", () => {
    const script = readFileSync("scripts/setup-overhaul-env.sh", "utf8");
    expect(script).not.toContain('rm -f "$file"');
  });
});
