import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { decryptIntegrationCredential } from "@/services/integrations/credential-crypto";
import { GoogleOAuthCallbackError } from "@/services/integrations/google/callback-observability";
import { GoogleIntegrationError } from "@/services/integrations/google/client";
import {
  completeGoogleConnection,
  disconnectGoogle,
  runGoogleCalendarSync
} from "@/services/integrations/google/service";
import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";

disposableDatabase();
const encryptionKey = randomBytes(32).toString("base64");

describe("Google integration authorization persistence", () => {
  beforeEach(async () => {
    process.env.PERSONALHUB_GOOGLE_CLIENT_ID =
      "test-client.apps.googleusercontent.com";
    process.env.PERSONALHUB_GOOGLE_CLIENT_SECRET = "test-client-secret-value";
    process.env.PERSONALHUB_INTEGRATION_ENCRYPTION_KEY = encryptionKey;
    process.env.PERSONALHUB_PUBLIC_ORIGIN = "https://personalhub.example";
    await assertDisposableDatabase((sql) => prisma.$queryRawUnsafe(sql));
    await prisma.externalResource.deleteMany();
    await prisma.integration.deleteMany();
  });
  afterAll(async () => prisma.$disconnect());

  it("stores only an authenticated encrypted refresh credential", async () => {
    const exchange = vi.fn().mockResolvedValue({
      refreshToken: "google-refresh-token-plaintext"
    });
    const connected = await completeGoogleConnection(
      "authorization-code",
      "pkce-verifier",
      { exchange }
    );
    const persisted = await prisma.integration.findUniqueOrThrow({
      where: { provider: "google" }
    });

    expect(exchange).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri:
          "https://personalhub.example/api/v1/integrations/google/callback"
      }),
      "authorization-code",
      "pkce-verifier"
    );
    expect(persisted.encryptedRefreshToken).not.toContain(
      "google-refresh-token-plaintext"
    );
    expect(
      decryptIntegrationCredential(
        persisted.encryptedRefreshToken!,
        encryptionKey,
        { integrationId: connected.id, provider: "google" }
      )
    ).toBe("google-refresh-token-plaintext");
  });

  it("logs only bounded successful OAuth transitions", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await completeGoogleConnection("sensitive-code", "sensitive-verifier", {
        exchange: async () => ({ refreshToken: "sensitive-refresh-token" })
      });
      const captured = output.mock.calls.flat().join("\n");
      expect(captured).toContain("google_oauth_token_exchange_started");
      expect(captured).toContain("google_oauth_token_exchange_succeeded");
      expect(captured).toContain("google_oauth_refresh_credential_present");
      expect(captured).toContain("google_oauth_scopes_valid");
      expect(captured).toContain("google_integration_connected");
      expect(captured).not.toContain("sensitive-code");
      expect(captured).not.toContain("sensitive-verifier");
      expect(captured).not.toContain("sensitive-refresh-token");
    } finally {
      output.mockRestore();
    }
  });

  it.each([
    [new Error("provider detail"), "token_exchange"],
    [new GoogleIntegrationError("MISSING_REFRESH_TOKEN"), "refresh_token"],
    [new GoogleIntegrationError("INSUFFICIENT_SCOPE"), "scope_validation"]
  ] as const)(
    "classifies an exchange failure without persistence as %s",
    async (error, stage) => {
      await expect(
        completeGoogleConnection("code", "verifier", {
          exchange: async () => {
            throw error;
          }
        })
      ).rejects.toEqual(new GoogleOAuthCallbackError(stage));
      expect(await prisma.integration.count()).toBe(0);
    }
  );

  it("classifies credential encryption failure without persistence", async () => {
    await expect(
      completeGoogleConnection("code", "verifier", {
        exchange: async () => ({ refreshToken: "refresh" }),
        encryptCredential: () => {
          throw new Error("encryption detail");
        }
      })
    ).rejects.toEqual(new GoogleOAuthCallbackError("credential_encryption"));
    expect(await prisma.integration.count()).toBe(0);
  });

  it("classifies persistence failure without a falsely connected row", async () => {
    await expect(
      completeGoogleConnection("code", "verifier", {
        exchange: async () => ({ refreshToken: "refresh" }),
        persistIntegration: async () => {
          throw new Error("database detail");
        }
      })
    ).rejects.toEqual(new GoogleOAuthCallbackError("persistence"));
    expect(await prisma.integration.count()).toBe(0);
  });

  it("attempts revocation, clears authorization locally, and preserves calendar identity", async () => {
    await completeGoogleConnection("code", "verifier", {
      exchange: async () => ({ refreshToken: "refresh-to-revoke" })
    });
    await prisma.integration.update({
      where: { provider: "google" },
      data: { externalCalendarId: "preserved-calendar" }
    });
    const revoke = vi.fn().mockResolvedValue(true);

    await expect(disconnectGoogle(revoke)).resolves.toEqual({ revoked: true });
    expect(revoke).toHaveBeenCalledWith("refresh-to-revoke");
    expect(
      await prisma.integration.findUniqueOrThrow({
        where: { provider: "google" }
      })
    ).toMatchObject({
      status: "disconnected",
      encryptedRefreshToken: null,
      externalCalendarId: "preserved-calendar"
    });
  });

  it("does not disconnect while a projection sync owns the integration lease", async () => {
    await completeGoogleConnection("authorization-code", "pkce-verifier", {
      exchange: async () => ({
        refreshToken: "refresh-secret"
      })
    });
    const integration = await prisma.integration.findUniqueOrThrow({
      where: { provider: "google" }
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        syncLeaseId: "active-sync",
        syncLeaseExpiresAt: new Date(Date.now() + 60_000)
      }
    });
    const revoke = vi.fn(async () => true);

    await expect(disconnectGoogle(revoke)).rejects.toEqual(
      expect.objectContaining({ code: "SYNC_IN_PROGRESS" })
    );
    expect(revoke).not.toHaveBeenCalled();
    expect(
      await prisma.integration.findUnique({
        where: { provider: "google" },
        select: { status: true, encryptedRefreshToken: true }
      })
    ).toEqual({
      status: "connected",
      encryptedRefreshToken: expect.any(String)
    });
  });

  it("marks revoked authorization for explicit reconnection and removes the unusable credential", async () => {
    await completeGoogleConnection("code", "verifier", {
      exchange: async () => ({ refreshToken: "revoked-refresh" })
    });
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400
      })
    );
    try {
      await expect(runGoogleCalendarSync()).rejects.toMatchObject({
        code: "REAUTHORIZATION_REQUIRED"
      });
    } finally {
      request.mockRestore();
    }
    expect(
      await prisma.integration.findUniqueOrThrow({
        where: { provider: "google" }
      })
    ).toMatchObject({
      status: "reauthorization_required",
      encryptedRefreshToken: null,
      lastSyncErrorCode: "REAUTHORIZATION_REQUIRED"
    });
  });
});
