CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "encryptedRefreshToken" TEXT,
    "externalAccountIdentity" TEXT,
    "externalCalendarId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastSyncErrorCode" TEXT,
    "syncLeaseId" TEXT,
    "syncLeaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalResource" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "localEntityType" TEXT NOT NULL,
    "localEntityId" TEXT NOT NULL,
    "externalResourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Integration_provider_key" ON "Integration"("provider");
CREATE UNIQUE INDEX "ExternalResource_provider_localEntityType_localEntityId_key" ON "ExternalResource"("provider", "localEntityType", "localEntityId");
CREATE UNIQUE INDEX "ExternalResource_integrationId_externalResourceId_key" ON "ExternalResource"("integrationId", "externalResourceId");
CREATE INDEX "ExternalResource_integrationId_idx" ON "ExternalResource"("integrationId");

ALTER TABLE "ExternalResource" ADD CONSTRAINT "ExternalResource_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;