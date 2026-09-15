import { describe, expect, it } from "vitest";
import { validateServerEnvironment } from "@/lib/env";

describe("server environment validation", () => {
  it("accepts PostgreSQL server configuration", () => {
    expect(() =>
      validateServerEnvironment({
        NODE_ENV: "production",
        PERSONALHUB_DATABASE_URL:
          "postgresql://app:secret@database:5432/personalhub?schema=public",
        PERSONALHUB_TRUST_PROXY: "true"
      })
    ).not.toThrow();
  });

  it("rejects missing, non-PostgreSQL, and invalid trust proxy configuration", () => {
    expect(() =>
      validateServerEnvironment({ NODE_ENV: "production" })
    ).toThrow();
    expect(() =>
      validateServerEnvironment({
        PERSONALHUB_DATABASE_URL: "file:./personalhub.db"
      })
    ).toThrow();
    expect(() =>
      validateServerEnvironment({
        PERSONALHUB_DATABASE_URL:
          "postgresql://app:secret@localhost/personalhub",
        PERSONALHUB_TRUST_PROXY: "yes"
      })
    ).toThrow();
  });
});
