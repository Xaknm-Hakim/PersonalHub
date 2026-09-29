import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth/web-session";
import { googleIntegrationEnv } from "@/lib/env";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_OAUTH_COOKIE
} from "@/services/integrations/google/constants";
import {
  createGoogleOAuthTransaction,
  deriveOAuthTransactionSigningKey,
  googleAuthorizationUrl
} from "@/services/integrations/google/oauth";

export async function GET() {
  const ownerSession = await requireOwnerSession();
  const config = googleIntegrationEnv();
  const transaction = createGoogleOAuthTransaction(
    deriveOAuthTransactionSigningKey(config.encryptionKey),
    ownerSession.id
  );
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_COOKIE, transaction.cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: GOOGLE_CALLBACK_PATH,
    maxAge: 10 * 60
  });
  return NextResponse.redirect(
    googleAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: `${config.publicOrigin}${GOOGLE_CALLBACK_PATH}`,
      scope: GOOGLE_CALENDAR_SCOPE,
      state: transaction.state,
      codeChallenge: transaction.codeChallenge
    })
  );
}
