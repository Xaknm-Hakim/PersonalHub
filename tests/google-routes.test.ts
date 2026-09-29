import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sessionError: null as Error | null,
  initiatingSessionId: "owner-session",
  validSessionIds: new Set<string>(["owner-session"]),
  cookieValue: "",
  complete: vi.fn(),
  sync: vi.fn(),
  disconnect: vi.fn()
}));

vi.mock("@/lib/auth/web-session", () => ({
  requireOwnerSession: vi.fn(async () => {
    if (state.sessionError) throw state.sessionError;
    return { id: state.initiatingSessionId };
  })
}));
vi.mock("@/lib/auth/owner", () => ({
  validateSessionId: vi.fn(async (id: string) =>
    state.validSessionIds.has(id) ? { id, ownerId: "owner" } : null
  )
}));
vi.mock("@/lib/env", () => ({
  googleIntegrationEnv: () => ({
    clientId: "client.apps.googleusercontent.com",
    clientSecret: "client-secret",
    encryptionKey: Buffer.alloc(32).toString("base64"),
    publicOrigin: "https://personalhub.example"
  })
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookieValue ? { value: state.cookieValue } : undefined),
    set: (_name: string, value: string) => {
      state.cookieValue = value;
    }
  })
}));
vi.mock("@/services/integrations/google/service", () => ({
  completeGoogleConnection: state.complete,
  runGoogleCalendarSync: state.sync,
  disconnectGoogle: state.disconnect
}));

import { GET as connect } from "@/app/api/v1/integrations/google/connect/route";
import { GET as callback } from "@/app/api/v1/integrations/google/callback/route";
import { POST as sync } from "@/app/api/v1/integrations/google/sync/route";
import {
  createGoogleOAuthTransaction,
  deriveOAuthTransactionSigningKey
} from "@/services/integrations/google/oauth";

const signingKey = deriveOAuthTransactionSigningKey(
  Buffer.alloc(32).toString("base64")
);

function transaction(sessionId = "owner-session", now?: number) {
  return createGoogleOAuthTransaction(signingKey, sessionId, now);
}

function callbackRequest(stateValue: string, suffix = "&code=code") {
  return new Request(
    `https://personalhub.example/api/v1/integrations/google/callback?state=${stateValue}${suffix}`
  );
}

describe("Google browser integration route security", () => {
  beforeEach(() => {
    state.sessionError = null;
    state.initiatingSessionId = "owner-session";
    state.validSessionIds = new Set(["owner-session"]);
    state.cookieValue = "";
    state.complete.mockReset().mockResolvedValue({ id: "integration" });
    state.sync.mockReset();
    state.disconnect.mockReset();
  });

  it("requires owner browser authentication and does not accept API-token-only initiation", async () => {
    state.sessionError = new Error("unauthenticated");
    await expect(connect()).rejects.toThrow("unauthenticated");
  });

  it("binds initiation to the exact owner session", async () => {
    const response = await connect();
    const parsed = new URL(response.headers.get("location")!);
    expect(parsed.searchParams.get("state")).toBeTruthy();
    expect(state.cookieValue).toBeTruthy();
    expect(state.cookieValue).not.toContain("owner-session");
  });

  it("completes without the Strict owner cookie when the bound session remains valid", async () => {
    const pending = transaction();
    state.cookieValue = pending.cookieValue;
    const response = await callback(callbackRequest(pending.state));

    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/settings?google=connected"
    );
    expect(state.complete).toHaveBeenCalledWith(
      "code",
      expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/)
    );
    expect(state.cookieValue).toBe("");
  });

  it("rejects callback state mismatch before token exchange", async () => {
    state.cookieValue = transaction().cookieValue;
    const response = await callback(callbackRequest("wrong"));
    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/settings?google=state_error"
    );
    expect(state.complete).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", ""],
    ["malformed", "not-a-signed-transaction"],
    ["expired", transaction("owner-session", 0).cookieValue]
  ])("rejects %s transaction state", async (_label, cookieValue) => {
    state.cookieValue = cookieValue;
    const response = await callback(callbackRequest("state"));
    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/settings?google=callback_error"
    );
    expect(state.complete).not.toHaveBeenCalled();
  });

  it.each(["revoked-session", "unrelated-session"])(
    "rejects a transaction bound to %s",
    async (sessionId) => {
      const pending = transaction(sessionId);
      state.cookieValue = pending.cookieValue;
      const response = await callback(callbackRequest(pending.state));
      expect(response.headers.get("location")).toBe(
        "https://personalhub.example/settings?google=callback_error"
      );
      expect(state.complete).not.toHaveBeenCalled();
    }
  );

  it("rejects replay after the transaction cookie is cleared", async () => {
    const pending = transaction();
    state.cookieValue = pending.cookieValue;
    await callback(callbackRequest(pending.state));
    const replay = await callback(callbackRequest(pending.state));
    expect(replay.headers.get("location")).toBe(
      "https://personalhub.example/settings?google=callback_error"
    );
    expect(state.complete).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin manual sync before provider access", async () => {
    const response = await sync(
      new Request(
        "https://personalhub.example/api/v1/integrations/google/sync",
        {
          method: "POST",
          headers: { origin: "https://attacker.example" }
        }
      )
    );
    expect(response.status).toBe(403);
    expect(state.sync).not.toHaveBeenCalled();
  });
});
