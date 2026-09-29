import { describe, expect, it } from "vitest";
import {
  createGoogleOAuthTransaction,
  googleAuthorizationUrl,
  parseGoogleOAuthTransaction
} from "@/services/integrations/google/oauth";
import { GOOGLE_CALENDAR_SCOPE } from "@/services/integrations/google/constants";

const signingKey = "test-only-oauth-cookie-key-that-is-long-enough";
const ownerSessionId = "owner-session";

describe("Google OAuth transaction state", () => {
  it("creates a signed short-lived state and PKCE transaction", () => {
    const transaction = createGoogleOAuthTransaction(
      signingKey,
      ownerSessionId,
      1_000
    );
    expect(transaction.state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(transaction.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(
      parseGoogleOAuthTransaction(transaction.cookieValue, signingKey, 1_001)
    ).toMatchObject({
      state: transaction.state,
      ownerSessionId,
      codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/)
    });
  });

  it("requests only app-created calendar access with offline authorization and PKCE", () => {
    const url = googleAuthorizationUrl({
      clientId: "client.apps.googleusercontent.com",
      redirectUri: "https://personalhub.example/callback",
      state: "state",
      codeChallenge: "challenge",
      scope: GOOGLE_CALENDAR_SCOPE
    });
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_CALENDAR_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("rejects missing, expired, and tampered transaction state without leaking values", () => {
    const transaction = createGoogleOAuthTransaction(
      signingKey,
      ownerSessionId,
      1_000
    );
    expect(() =>
      parseGoogleOAuthTransaction(
        transaction.cookieValue,
        signingKey,
        1_700_001
      )
    ).toThrowError("Google authorization transaction is invalid or expired.");
    expect(() =>
      parseGoogleOAuthTransaction(
        `${transaction.cookieValue.slice(0, -1)}x`,
        signingKey,
        1_001
      )
    ).toThrowError("Google authorization transaction is invalid or expired.");
    expect(() =>
      parseGoogleOAuthTransaction("", signingKey, 1_001)
    ).toThrowError("Google authorization transaction is invalid or expired.");
  });
});
