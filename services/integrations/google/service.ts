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

export async function completeGoogleConnection(
  code: string,
  codeVerifier: string,
  exchange = exchangeGoogleAuthorizationCode
) {
  const config = configuration();
  const { refreshToken } = await exchange(
    {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri
    },
    code,
    codeVerifier
  );
  const existing = await prisma.integration.findUnique({
    where: { provider: GOOGLE_PROVIDER },
    select: { id: true }
  });
  const integrationId = existing?.id ?? randomUUID();
  const encryptedRefreshToken = encryptIntegrationCredential(
    refreshToken,
    config.encryptionKey,
    { integrationId, provider: GOOGLE_PROVIDER }
  );
  const connectedAt = new Date();
  const integration = await prisma.integration.upsert({
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
