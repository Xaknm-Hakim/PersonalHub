import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSessionId } from "@/lib/auth/owner";
import { googleIntegrationEnv } from "@/lib/env";
import { logEvent } from "@/lib/logging";
import { completeGoogleConnection } from "@/services/integrations/google/service";
import {
  googleOAuthFailure,
  type GoogleOAuthFailureStage,
  type GoogleOAuthTokenExchangeReason
} from "@/services/integrations/google/callback-observability";
import type { GoogleOAuthCompletionResult } from "@/services/integrations/google/completion";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_OAUTH_COOKIE
} from "@/services/integrations/google/constants";
import {
  deriveOAuthTransactionSigningKey,
  googleOAuthStateMatches,
  parseGoogleOAuthTransaction
} from "@/services/integrations/google/oauth";

function completionRedirect(
  origin: string,
  result: GoogleOAuthCompletionResult
) {
  return NextResponse.redirect(
    `${origin}/oauth/google/complete?google=${result}`
  );
}

function failureRedirect(
  origin: string,
  stage: GoogleOAuthFailureStage,
  result: GoogleOAuthCompletionResult = "callback_error",
  reason?: GoogleOAuthTokenExchangeReason
) {
  logEvent(
    "warn",
    "google_oauth_callback_failed",
    reason ? { stage, reason } : { stage }
  );
  const url = new URL("/oauth/google/complete", origin);
  url.searchParams.set("google", result);
  if (result === "callback_error") url.searchParams.set("stage", stage);
  if (result === "callback_error" && stage === "token_exchange" && reason)
    url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const config = googleIntegrationEnv();
  const url = new URL(request.url);
  logEvent("info", "google_oauth_callback_entered");
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GOOGLE_OAUTH_COOKIE)?.value ?? "";
  cookieStore.set(GOOGLE_OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: GOOGLE_CALLBACK_PATH,
    maxAge: 0
  });
  let transaction;
  try {
    transaction = parseGoogleOAuthTransaction(
      cookieValue,
      deriveOAuthTransactionSigningKey(config.encryptionKey)
    );
  } catch {
    return failureRedirect(config.publicOrigin, "transaction_validation");
  }
  logEvent("info", "google_oauth_transaction_valid");
  let boundSessionIsValid: boolean;
  try {
    boundSessionIsValid = Boolean(
      await validateSessionId(transaction.ownerSessionId)
    );
  } catch {
    return failureRedirect(config.publicOrigin, "session_validation");
  }
  if (!boundSessionIsValid)
    return failureRedirect(config.publicOrigin, "session_validation");
  logEvent("info", "google_oauth_session_valid");
  try {
    const state = url.searchParams.get("state") ?? "";
    if (!googleOAuthStateMatches(transaction.state, state))
      return failureRedirect(
        config.publicOrigin,
        "state_validation",
        "state_error"
      );
    logEvent("info", "google_oauth_state_valid");
    if (url.searchParams.has("error"))
      return failureRedirect(
        config.publicOrigin,
        "authorization_denied",
        "authorization_denied"
      );
    const code = url.searchParams.get("code");
    if (!code)
      return failureRedirect(config.publicOrigin, "authorization_code");
    await completeGoogleConnection(code, transaction.codeVerifier);
    return completionRedirect(config.publicOrigin, "connected");
  } catch (error) {
    const failure = googleOAuthFailure(error);
    return failureRedirect(
      config.publicOrigin,
      failure.stage,
      "callback_error",
      failure.reason
    );
  }
}
