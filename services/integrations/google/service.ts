import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { googleIntegrationEnv } from "@/lib/env";
import { logEvent } from "@/lib/logging";
import {
  decryptIntegrationCredential,
  encryptIntegrationCredential
} from "@/services/integrations/credential-crypto";
import {
  exchangeGoogleAuthorizationCode,
  GoogleCalendarApi,
  GoogleIntegrationError,
  refreshGoogleAccessToken,
  revokeGoogleAuthorization
} from "./client";
import {
  GoogleOAuthCallbackError,
  type GoogleOAuthTokenExchangeReason
} from "./callback-observability";
import { GOOGLE_CALLBACK_PATH, GOOGLE_PROVIDER } from "./constants";
import { syncGoogleCalendar, withGoogleSyncLease } from "./sync";

function configuration() {
  const config = googleIntegrationEnv();
  return {
    ...config,
    redirectUri: `${config.publicOrigin}${GOOGLE_CALLBACK_PATH}`
  };
}

export async function googleIntegrationStatus() {
  return prisma.integration.findUnique({
    where: { provider: GOOGLE_PROVIDER },
    select: {
      id: true,
      status: true,
      externalCalendarId: true,
      connectedAt: true,
      lastSuccessfulSyncAt: true,
      lastSyncErrorCode: true
    }
  });
}

type CompleteGoogleConnectionOptions = {
  exchange?: typeof exchangeGoogleAuthorizationCode;
  encryptCredential?: typeof encryptIntegrationCredential;
  persistIntegration?: (input: {
    integrationId: string;
    encryptedRefreshToken: string;
    connectedAt: Date;
  }) => Promise<{ id: string }>;
};

function tokenExchangeReason(error: unknown): GoogleOAuthTokenExchangeReason {
  if (!(error instanceof GoogleIntegrationError)) return "unexpected";
  if (error.code === "invalid_grant") return "provider_invalid_grant";
  if (error.code === "invalid_client") return "provider_invalid_client";
  if (error.code === "REQUEST_TIMEOUT") return "request_timeout";
  if (error.code === "NETWORK_ERROR") return "network_error";
  if (
    error.code === "UNAVAILABLE" ||
    error.code === "temporarily_unavailable" ||
    error.code === "server_error" ||
    (error.status !== undefined && error.status >= 500)
  )
    return "provider_unavailable";
  if (error.code === "MALFORMED_RESPONSE") return "malformed_response";
  if (error.status !== undefined && error.status >= 400 && error.status < 500)
    return "provider_rejected";
  if (error.status !== undefined) return "provider_http_error";
  return "unexpected";
}

function exchangeFailure(error: unknown) {
  if (
    error instanceof GoogleIntegrationError &&
    error.code === "MISSING_REFRESH_TOKEN"
  )
    return new GoogleOAuthCallbackError("refresh_token");
  if (
    error instanceof GoogleIntegrationError &&
    error.code === "INSUFFICIENT_SCOPE"
  )
    return new GoogleOAuthCallbackError("scope_validation");
  return new GoogleOAuthCallbackError(
    "token_exchange",
    tokenExchangeReason(error)
  );
}

export async function completeGoogleConnection(
  code: string,
  codeVerifier: string,
  options: CompleteGoogleConnectionOptions = {}
) {
  const config = configuration();
  const exchange = options.exchange ?? exchangeGoogleAuthorizationCode;
  logEvent("info", "google_oauth_token_exchange_started");
  let refreshToken: string;
  try {
    ({ refreshToken } = await exchange(
      {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri
      },
      code,
      codeVerifier
    ));
  } catch (error) {
    throw exchangeFailure(error);
  }
  logEvent("info", "google_oauth_token_exchange_succeeded");
  logEvent("info", "google_oauth_refresh_credential_present");
  logEvent("info", "google_oauth_scopes_valid");

  let existing: { id: string } | null;
  try {
    existing = await prisma.integration.findUnique({
      where: { provider: GOOGLE_PROVIDER },
      select: { id: true }
    });
  } catch {
    throw new GoogleOAuthCallbackError("persistence");
  }
  const integrationId = existing?.id ?? randomUUID();
  let encryptedRefreshToken: string;
  try {
    encryptedRefreshToken = (
      options.encryptCredential ?? encryptIntegrationCredential
    )(refreshToken, config.encryptionKey, {
      integrationId,
      provider: GOOGLE_PROVIDER
    });
  } catch {
    throw new GoogleOAuthCallbackError("credential_encryption");
  }

  const connectedAt = new Date();
  let integration: { id: string };
  try {
    integration = options.persistIntegration
      ? await options.persistIntegration({
          integrationId,
          encryptedRefreshToken,
          connectedAt
        })
      : await prisma.integration.upsert({
          where: { provider: GOOGLE_PROVIDER },
          create: {
            id: integrationId,
            provider: GOOGLE_PROVIDER,
            status: "connected",
            encryptedRefreshToken,
            connectedAt,
            lastSyncErrorCode: null
          },
          update: {
            status: "connected",
            encryptedRefreshToken,
            connectedAt,
            lastSyncErrorCode: null
          }
        });
  } catch {
    throw new GoogleOAuthCallbackError("persistence");
  }
  logEvent("info", "google_integration_connected", {
    provider: GOOGLE_PROVIDER,
    integrationId: integration.id,
    operation: "oauth_callback"
  });
  return integration;
}

export async function runGoogleCalendarSync() {
  const config = configuration();
  const integration = await prisma.integration.findUnique({
    where: { provider: GOOGLE_PROVIDER }
  });
  if (
    !integration ||
    integration.status !== "connected" ||
    !integration.encryptedRefreshToken
  )
    throw new GoogleIntegrationError("NOT_CONNECTED");
  const refreshToken = decryptIntegrationCredential(
    integration.encryptedRefreshToken,
    config.encryptionKey,
    { integrationId: integration.id, provider: GOOGLE_PROVIDER }
  );
  try {
    const accessToken = await refreshGoogleAccessToken(
      { clientId: config.clientId, clientSecret: config.clientSecret },
      refreshToken
    );
    return await syncGoogleCalendar(new GoogleCalendarApi(accessToken));
  } catch (error) {
    if (
      error instanceof GoogleIntegrationError &&
      error.code === "REAUTHORIZATION_REQUIRED"
    ) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "reauthorization_required",
          encryptedRefreshToken: null,
          lastSyncErrorCode: error.code
        }
      });
    }
    throw error;
  }
}

export async function disconnectGoogle(revoke = revokeGoogleAuthorization) {
  const config = configuration();
  const integration = await prisma.integration.findUnique({
    where: { provider: GOOGLE_PROVIDER }
  });
  if (!integration) return { revoked: false };
  return withGoogleSyncLease(integration.id, async (renewLease) => {
    let revoked = false;
    if (integration.encryptedRefreshToken) {
      await renewLease();
      try {
        const refreshToken = decryptIntegrationCredential(
          integration.encryptedRefreshToken,
          config.encryptionKey,
          { integrationId: integration.id, provider: GOOGLE_PROVIDER }
        );
        revoked = await revoke(refreshToken);
      } catch {
        revoked = false;
      }
    }
    await renewLease();
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "disconnected",
        encryptedRefreshToken: null,
        lastSyncErrorCode: null
      }
    });
    logEvent("info", "google_integration_disconnected", {
      provider: GOOGLE_PROVIDER,
      integrationId: integration.id,
      operation: "disconnect",
      revocationSucceeded: revoked
    });
    return { revoked };
  });
}
