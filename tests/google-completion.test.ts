import { describe, expect, it } from "vitest";
import {
  googleOAuthFailureStages,
  googleOAuthTokenExchangeReasons
} from "@/services/integrations/google/callback-observability";
import {
  googleOAuthCompletionBounceTarget,
  googleOAuthCompletionTarget
} from "@/services/integrations/google/completion";
import { GET as completion } from "@/app/oauth/google/complete/route";

describe("Google OAuth public completion bounce", () => {
  it.each([
    ["connected", "/settings?google=connected"],
    ["state_error", "/settings?google=state_error"],
    ["authorization_denied", "/settings?google=authorization_denied"]
  ])("preserves the bounded %s result", (google, target) => {
    expect(googleOAuthCompletionTarget({ google })).toBe(target);
  });

  it.each(googleOAuthFailureStages)(
    "preserves the bounded %s failure stage",
    (stage) => {
      expect(
        googleOAuthCompletionTarget({
          google: "callback_error",
          stage
        })
      ).toBe(`/settings?google=callback_error&stage=${stage}`);
    }
  );

  it.each(googleOAuthTokenExchangeReasons)(
    "preserves the bounded %s token exchange reason",
    (reason) => {
      expect(
        googleOAuthCompletionTarget({
          google: "callback_error",
          stage: "token_exchange",
          reason
        })
      ).toBe(
        `/settings?google=callback_error&stage=token_exchange&reason=${reason}`
      );
    }
  );

  it("drops unknown and irrelevant values rather than reflecting them", () => {
    expect(
      googleOAuthCompletionTarget({
        google: "callback_error",
        stage: "token_exchange",
        reason: "raw-provider-error",
        code: "secret-code",
        state: "secret-state",
        token: "secret-token",
        destination: "https://attacker.example"
      })
    ).toBe("/settings?google=callback_error&stage=token_exchange");
    expect(
      googleOAuthCompletionTarget({
        google: "https://attacker.example",
        stage: "raw-stage",
        reason: "raw-reason"
      })
    ).toBe("/settings?google=callback_error");
    expect(
      googleOAuthCompletionTarget({
        google: "connected",
        stage: "token_exchange",
        reason: "provider_invalid_grant"
      })
    ).toBe("/settings?google=connected");
  });

  it("never returns an external or non-Settings destination", () => {
    for (const input of [
      {},
      { google: ["connected", "callback_error"] },
      { google: "//attacker.example" },
      { google: "callback_error", stage: ["token_exchange"] }
    ]) {
      expect(googleOAuthCompletionTarget(input)).toMatch(
        /^\/settings\?google=(?:connected|callback_error|state_error|authorization_denied)/
      );
    }
  });

  it("builds a clean public-page fragment from bounded values only", () => {
    expect(
      googleOAuthCompletionBounceTarget({
        google: "callback_error",
        stage: "token_exchange",
        reason: "provider_invalid_grant",
        code: "secret-code",
        destination: "https://attacker.example"
      })
    ).toBe(
      "/oauth/google/complete/bounce#google=callback_error&stage=token_exchange&reason=provider_invalid_grant"
    );
  });

  it("redirects only to the fixed public bounce path with a bounded fragment", () => {
    const response = completion(
      new Request(
        "https://personalhub.example/oauth/google/complete?google=callback_error&stage=token_exchange&reason=provider_invalid_grant&code=secret-code&state=secret-state&destination=https%3A%2F%2Fattacker.example"
      )
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "/oauth/google/complete/bounce#google=callback_error&stage=token_exchange&reason=provider_invalid_grant"
    );
  });
});
