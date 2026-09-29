import { describe, expect, it } from "vitest";
import {
  googleIntegrationEnv,
  googleIntegrationIsConfigured,
  validateServerEnvironment
} from "@/lib/env";

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

describe("Google integration environment", () => {
  it("accepts an exact HTTPS origin and a 256-bit encryption key", () => {
    expect(
      googleIntegrationEnv({
        PERSONALHUB_GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
        PERSONALHUB_GOOGLE_CLIENT_SECRET: "secret",
        PERSONALHUB_INTEGRATION_ENCRYPTION_KEY:
          Buffer.alloc(32).toString("base64"),
        PERSONALHUB_PUBLIC_ORIGIN: "https://personalhub.example"
      })
    ).toMatchObject({ publicOrigin: "https://personalhub.example" });
  });

  it("rejects non-HTTPS origins and incorrectly sized keys", () => {
    const base = {
      PERSONALHUB_GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
      PERSONALHUB_GOOGLE_CLIENT_SECRET: "secret",
      PERSONALHUB_INTEGRATION_ENCRYPTION_KEY:
        Buffer.alloc(32).toString("base64"),
      PERSONALHUB_PUBLIC_ORIGIN: "http://personalhub.example"
    };
    expect(() => googleIntegrationEnv(base)).toThrow(/HTTPS origin/);
    expect(() =>
      googleIntegrationEnv({
        ...base,
        PERSONALHUB_PUBLIC_ORIGIN: "https://personalhub.example",
        PERSONALHUB_INTEGRATION_ENCRYPTION_KEY:
          Buffer.alloc(31).toString("base64")
      })
    ).toThrow(/32 bytes/);
  });

  it("keeps Google optional when integration configuration is absent", () => {
    expect(googleIntegrationIsConfigured({})).toBe(false);
  });
});
