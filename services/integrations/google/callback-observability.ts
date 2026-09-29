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

export class GoogleOAuthCallbackError extends Error {
  constructor(public readonly stage: GoogleOAuthFailureStage) {
    super("Google OAuth callback did not complete.");
    this.name = "GoogleOAuthCallbackError";
  }
}

export function googleOAuthFailureStage(error: unknown) {
  return error instanceof GoogleOAuthCallbackError
    ? error.stage
    : "callback_processing";
}
