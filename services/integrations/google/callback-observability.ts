export const googleOAuthFailureStages = [
  "transaction_validation",
  "session_validation",
  "state_validation",
  "authorization_denied",
  "authorization_code",
  "token_exchange",
  "refresh_token",
  "scope_validation",
  "credential_encryption",
  "persistence",
  "callback_processing"
] as const;

export type GoogleOAuthFailureStage = (typeof googleOAuthFailureStages)[number];

export const googleOAuthTokenExchangeReasons = [
  "provider_invalid_grant",
  "provider_invalid_client",
  "provider_rejected",
  "provider_unavailable",
  "provider_http_error",
  "request_timeout",
  "malformed_response",
  "network_error",
  "unexpected"
] as const;

export type GoogleOAuthTokenExchangeReason =
  (typeof googleOAuthTokenExchangeReasons)[number];

export class GoogleOAuthCallbackError extends Error {
  public readonly reason?: GoogleOAuthTokenExchangeReason;

  constructor(
    public readonly stage: GoogleOAuthFailureStage,
    reason?: GoogleOAuthTokenExchangeReason
  ) {
    super("Google OAuth callback did not complete.");
    this.name = "GoogleOAuthCallbackError";
    this.reason = stage === "token_exchange" ? reason : undefined;
  }
}

export function googleOAuthFailure(error: unknown): {
  stage: GoogleOAuthFailureStage;
  reason?: GoogleOAuthTokenExchangeReason;
} {
  return error instanceof GoogleOAuthCallbackError
    ? { stage: error.stage, reason: error.reason }
    : { stage: "callback_processing" };
}
