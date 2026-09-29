import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSessionId } from "@/lib/auth/owner";
import { googleIntegrationEnv } from "@/lib/env";
import { completeGoogleConnection } from "@/services/integrations/google/service";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_OAUTH_COOKIE
} from "@/services/integrations/google/constants";
import {
  deriveOAuthTransactionSigningKey,
  googleOAuthStateMatches,
  parseGoogleOAuthTransaction
} from "@/services/integrations/google/oauth";

function settingsRedirect(origin: string, result: string) {
  return NextResponse.redirect(`${origin}/settings?google=${result}`);
}

export async function GET(request: Request) {
  const config = googleIntegrationEnv();
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GOOGLE_OAUTH_COOKIE)?.value ?? "";
  cookieStore.set(GOOGLE_OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: GOOGLE_CALLBACK_PATH,
    maxAge: 0
  });
  try {
    const transaction = parseGoogleOAuthTransaction(
      cookieValue,
      deriveOAuthTransactionSigningKey(config.encryptionKey)
    );
    if (!(await validateSessionId(transaction.ownerSessionId)))
      return settingsRedirect(config.publicOrigin, "callback_error");
    const state = url.searchParams.get("state") ?? "";
    if (!googleOAuthStateMatches(transaction.state, state))
      return settingsRedirect(config.publicOrigin, "state_error");
    if (url.searchParams.has("error"))
      return settingsRedirect(config.publicOrigin, "authorization_denied");
    const code = url.searchParams.get("code");
    if (!code) return settingsRedirect(config.publicOrigin, "callback_error");
    await completeGoogleConnection(code, transaction.codeVerifier);
    return settingsRedirect(config.publicOrigin, "connected");
  } catch {
    return settingsRedirect(config.publicOrigin, "callback_error");
  }
}
