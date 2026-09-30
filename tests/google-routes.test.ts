import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sessionError: null as Error | null,
  sessionValidationError: null as Error | null,
  initiatingSessionId: "owner-session",
  validSessionIds: new Set<string>(["owner-session"]),
  cookieValue: "",
  logEvent: vi.fn(),
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
  validateSessionId: vi.fn(async (id: string) => {
    if (state.sessionValidationError) throw state.sessionValidationError;
    return state.validSessionIds.has(id) ? { id, ownerId: "owner" } : null;
  })
}));
vi.mock("@/lib/env", () => ({
  googleIntegrationEnv: () => ({
    clientId: "client.apps.googleusercontent.com",
    clientSecret: "client-secret",
    encryptionKey: Buffer.alloc(32).toString("base64"),
    publicOrigin: "https://personalhub.example"
  })
}));
vi.mock("@/lib/logging", () => ({ logEvent: state.logEvent }));
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
import { GoogleOAuthCallbackError } from "@/services/integrations/google/callback-observability";
import {
  createGoogleOAuthTransaction,
  deriveOAuthTransactionSigningKey,
  parseGoogleOAuthTransaction
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
    state.sessionValidationError = null;
    state.initiatingSessionId = "owner-session";
    state.validSessionIds = new Set(["owner-session"]);
    state.cookieValue = "";
    state.logEvent.mockReset();
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
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://personalhub.example/api/v1/integrations/google/callback"
    );
    expect(state.cookieValue).toBeTruthy();
    expect(state.cookieValue).not.toContain("owner-session");
  });

  it("completes without the Strict owner cookie when the bound session remains valid", async () => {
    const pending = transaction();
    state.cookieValue = pending.cookieValue;
    const response = await callback(callbackRequest(pending.state));

    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/oauth/google/complete?google=connected"
    );
    expect(state.complete).toHaveBeenCalledWith(
      "code",
      parseGoogleOAuthTransaction(pending.cookieValue, signingKey).codeVerifier
    );
    expect(state.cookieValue).toBe("");
  });

  it("logs callback transitions without logging OAuth or session values", async () => {
    const sessionId = "sensitive-session-identifier";
    const authorizationCode = "sensitive-authorization-code";
    state.validSessionIds = new Set([sessionId]);
    const pending = transaction(sessionId);
    state.cookieValue = pending.cookieValue;

    await callback(
      callbackRequest(pending.state, `&code=${authorizationCode}`)
    );

    const captured = JSON.stringify(state.logEvent.mock.calls);
    expect(captured).toContain("google_oauth_callback_entered");
    expect(captured).toContain("google_oauth_transaction_valid");
    expect(captured).toContain("google_oauth_session_valid");
    expect(captured).toContain("google_oauth_state_valid");
    expect(captured).not.toContain(sessionId);
    expect(captured).not.toContain(authorizationCode);
    expect(captured).not.toContain(pending.state);
    expect(captured).not.toContain(pending.cookieValue);
  });

  it("rejects callback state mismatch before token exchange", async () => {
    state.cookieValue = transaction().cookieValue;
    const response = await callback(callbackRequest("wrong"));
    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/oauth/google/complete?google=state_error"
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
      "https://personalhub.example/oauth/google/complete?google=callback_error&stage=transaction_validation"
    );
    expect(state.logEvent).toHaveBeenCalledWith(
      "warn",
      "google_oauth_callback_failed",
      { stage: "transaction_validation" }
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
        "https://personalhub.example/oauth/google/complete?google=callback_error&stage=session_validation"
      );
      expect(state.complete).not.toHaveBeenCalled();
    }
  );

  it("fails closed when bound-session validation cannot complete", async () => {
    const pending = transaction();
    state.cookieValue = pending.cookieValue;
    state.sessionValidationError = new Error("database detail");

    const response = await callback(callbackRequest(pending.state));

    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/oauth/google/complete?google=callback_error&stage=session_validation"
    );
    expect(state.complete).not.toHaveBeenCalled();
  });

  it("rejects replay after the transaction cookie is cleared", async () => {
    const pending = transaction();
    state.cookieValue = pending.cookieValue;
    await callback(callbackRequest(pending.state));
    const replay = await callback(callbackRequest(pending.state));
    expect(replay.headers.get("location")).toBe(
      "https://personalhub.example/oauth/google/complete?google=callback_error&stage=transaction_validation"
    );
    expect(state.complete).toHaveBeenCalledTimes(1);
  });

  it("keeps state mismatch and provider denial distinguishable", async () => {
    const stateMismatch = transaction();
    state.cookieValue = stateMismatch.cookieValue;
    expect(
      (await callback(callbackRequest("wrong"))).headers.get("location")
    ).toBe(
      "https://personalhub.example/oauth/google/complete?google=state_error"
    );

    const denied = transaction();
    state.cookieValue = denied.cookieValue;
    expect(
      (
        await callback(callbackRequest(denied.state, "&error=access_denied"))
      ).headers.get("location")
    ).toBe(
      "https://personalhub.example/oauth/google/complete?google=authorization_denied"
    );
  });

  it("classifies a missing authorization code", async () => {
    const pending = transaction();
    state.cookieValue = pending.cookieValue;
    const response = await callback(callbackRequest(pending.state, ""));
    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/oauth/google/complete?google=callback_error&stage=authorization_code"
    );
    expect(state.complete).not.toHaveBeenCalled();
  });

  it.each([
    "token_exchange",
    "refresh_token",
    "scope_validation",
    "credential_encryption",
    "persistence"
  ] as const)(
    "redirects a %s failure using only its bounded stage",
    async (stage) => {
      const pending = transaction();
      state.cookieValue = pending.cookieValue;
      state.complete.mockRejectedValueOnce(new GoogleOAuthCallbackError(stage));

      const response = await callback(callbackRequest(pending.state));

      expect(response.headers.get("location")).toBe(
        `https://personalhub.example/oauth/google/complete?google=callback_error&stage=${stage}`
      );
      expect(state.logEvent).toHaveBeenLastCalledWith(
        "warn",
        "google_oauth_callback_failed",
        { stage }
      );
    }
  );

  it("logs and redirects a bounded token exchange reason", async () => {
    const pending = transaction();
    state.cookieValue = pending.cookieValue;
    state.complete.mockRejectedValueOnce(
      new GoogleOAuthCallbackError("token_exchange", "provider_invalid_grant")
    );

    const response = await callback(callbackRequest(pending.state));

    expect(response.headers.get("location")).toBe(
      "https://personalhub.example/oauth/google/complete?google=callback_error&stage=token_exchange&reason=provider_invalid_grant"
    );
    expect(state.logEvent).toHaveBeenLastCalledWith(
      "warn",
      "google_oauth_callback_failed",
      { stage: "token_exchange", reason: "provider_invalid_grant" }
    );
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
