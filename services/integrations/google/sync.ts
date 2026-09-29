import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dateOnly, addDays } from "@/lib/domain/dates";
import { isAssignmentClosed, isTaskClosed } from "@/lib/domain/status";
import { logEvent } from "@/lib/logging";
import { GOOGLE_CALENDAR_NAME, GOOGLE_PROVIDER } from "./constants";
import { GoogleIntegrationError } from "./client";

export type GoogleEventProjection = {
  summary: string;
  startDate: string;
  endDate: string;
  localEntityType: "task" | "assignment" | "other";
  localEntityId: string;
};

export interface GoogleCalendarGateway {
  createCalendar(summary: string, managementMarker: string): Promise<string>;
  findManagedCalendars(managementMarker: string): Promise<string[]>;
  calendarExists(calendarId: string): Promise<boolean>;
  upsertEvent(
    calendarId: string,
    eventId: string,
    projection: GoogleEventProjection
  ): Promise<string>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

type EligibleItem = {
  type: "task" | "assignment";
  id: string;
  title: string;
  date: Date;
};

export class GoogleSyncError extends Error {
  constructor(
    public code: string,
    public result?: GoogleSyncResult
  ) {
    super("Google Calendar synchronization did not complete.");
    this.name = "GoogleSyncError";
  }
}

type GoogleSyncResult = {
  eligible: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
};

function eventId(type: string, id: string) {
  return `ph${createHash("sha256").update(`${type}:${id}`).digest("hex")}`;
}

function projection(item: EligibleItem): GoogleEventProjection {
  const startDate = dateOnly(item.date)!;
  return {
    summary: `${item.type === "task" ? "Task" : "Assignment"}: ${item.title}`,
    startDate,
    endDate: dateOnly(addDays(item.date, 1))!,
    localEntityType: item.type,
    localEntityId: item.id
  };
}

function safeCode(error: unknown) {
  return error instanceof GoogleIntegrationError
    ? error.code
    : "SYNC_ITEM_FAILED";
}

async function eligibleItems(): Promise<EligibleItem[]> {
  const [tasks, assignments] = await Promise.all([
    prisma.task.findMany({ where: { dueDate: { not: null } } }),
    prisma.assignment.findMany()
  ]);
  return [
    ...tasks.flatMap((task) =>
      task.dueDate && !isTaskClosed(task.status)
        ? [
            {
              type: "task" as const,
              id: task.id,
              title: task.title,
              date: task.dueDate
            }
          ]
        : []
    ),
    ...assignments.flatMap((assignment) =>
      !isAssignmentClosed(assignment.status)
        ? [
            {
              type: "assignment" as const,
              id: assignment.id,
              title: assignment.title,
              date: assignment.deadline
            }
          ]
        : []
    )
  ];
}

async function reconcileGoogleCalendar(
  integrationId: string,
  google: GoogleCalendarGateway,
  renewLease: () => Promise<void>
): Promise<GoogleSyncResult> {
  const startedAt = Date.now();
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    include: { externalResources: true }
  });
  if (
    !integration ||
    integration.status !== "connected" ||
    !integration.encryptedRefreshToken
  )
    throw new GoogleSyncError("NOT_CONNECTED");

  let calendarId = integration.externalCalendarId;
  const managementMarker = `personalhub-integration:${integration.id}`;
  try {
    await renewLease();
    if (!calendarId || !(await google.calendarExists(calendarId))) {
      const managedCalendars =
        await google.findManagedCalendars(managementMarker);
      if (managedCalendars.length > 1)
        throw new GoogleIntegrationError("MULTIPLE_MANAGED_CALENDARS");
      calendarId =
        managedCalendars[0] ??
        (await google.createCalendar(GOOGLE_CALENDAR_NAME, managementMarker));
      await prisma.integration.update({
        where: { id: integration.id },
        data: { externalCalendarId: calendarId }
      });
    }
  } catch (error) {
    const code = safeCode(error);
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncErrorCode: code }
    });
    throw new GoogleSyncError(code);
  }

  const items = await eligibleItems();
  const eligibleKeys = new Set(items.map((item) => `${item.type}:${item.id}`));
  const mappings = new Map(
    integration.externalResources.map((mapping) => [
      `${mapping.localEntityType}:${mapping.localEntityId}`,
      mapping
    ])
  );
  const result: GoogleSyncResult = {
    eligible: items.length,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0
  };
  let firstErrorCode: string | undefined;

  for (const item of items) {
    const key = `${item.type}:${item.id}`;
    const mapping = mappings.get(key);
    const deterministicEventId =
      mapping?.externalResourceId ?? eventId(item.type, item.id);
    try {
      await renewLease();
      const externalResourceId = await google.upsertEvent(
        calendarId,
        deterministicEventId,
        projection(item)
      );
      await prisma.externalResource.upsert({
        where: {
          provider_localEntityType_localEntityId: {
            provider: GOOGLE_PROVIDER,
            localEntityType: item.type,
            localEntityId: item.id
          }
        },
        create: {
          integrationId: integration.id,
          provider: GOOGLE_PROVIDER,
          localEntityType: item.type,
          localEntityId: item.id,
          externalResourceId
        },
        update: { externalResourceId }
      });
      if (mapping) result.updated += 1;
      else result.created += 1;
    } catch (error) {
      result.failed += 1;
      firstErrorCode ??= safeCode(error);
    }
  }

  for (const mapping of integration.externalResources) {
    const key = `${mapping.localEntityType}:${mapping.localEntityId}`;
    if (eligibleKeys.has(key)) continue;
    try {
      await renewLease();
      await google.deleteEvent(calendarId, mapping.externalResourceId);
      await prisma.externalResource.delete({ where: { id: mapping.id } });
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      firstErrorCode ??= safeCode(error);
    }
  }

  if (result.failed) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncErrorCode: firstErrorCode ?? "PARTIAL_FAILURE" }
    });
    logEvent("warn", "google_calendar_sync_failed", {
      provider: GOOGLE_PROVIDER,
      integrationId: integration.id,
      operation: "manual_sync",
      eligible: result.eligible,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      failed: result.failed,
      errorCode: firstErrorCode,
      durationMs: Date.now() - startedAt
    });
    throw new GoogleSyncError("PARTIAL_FAILURE", result);
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { lastSuccessfulSyncAt: new Date(), lastSyncErrorCode: null }
  });
  logEvent("info", "google_calendar_sync_succeeded", {
    provider: GOOGLE_PROVIDER,
    integrationId: integration.id,
    operation: "manual_sync",
    ...result,
    durationMs: Date.now() - startedAt
  });
  return result;
}

export async function syncGoogleCalendar(
  google: GoogleCalendarGateway
): Promise<GoogleSyncResult> {
  const integration = await prisma.integration.findUnique({
    where: { provider: GOOGLE_PROVIDER },
    select: { id: true, status: true, encryptedRefreshToken: true }
  });
  if (
    !integration ||
    integration.status !== "connected" ||
    !integration.encryptedRefreshToken
  )
    throw new GoogleSyncError("NOT_CONNECTED");
  return withGoogleSyncLease(integration.id, (renewLease) =>
    reconcileGoogleCalendar(integration.id, google, renewLease)
  );
}

export async function withGoogleSyncLease<T>(
  integrationId: string,
  operation: (renewLease: () => Promise<void>) => Promise<T>
) {
  const leaseId = randomUUID();
  const now = new Date();
  const lease = await prisma.integration.updateMany({
    where: {
      id: integrationId,
      OR: [
        { syncLeaseId: null },
        { syncLeaseExpiresAt: null },
        { syncLeaseExpiresAt: { lt: now } }
      ]
    },
    data: {
      syncLeaseId: leaseId,
      syncLeaseExpiresAt: new Date(now.getTime() + 10 * 60 * 1000)
    }
  });
  if (lease.count !== 1) throw new GoogleSyncError("SYNC_IN_PROGRESS");
  const renewLease = async () => {
    const renewed = await prisma.integration.updateMany({
      where: { id: integrationId, syncLeaseId: leaseId },
      data: { syncLeaseExpiresAt: new Date(Date.now() + 10 * 60 * 1000) }
    });
    if (renewed.count !== 1) throw new GoogleSyncError("SYNC_LEASE_LOST");
  };
  try {
    return await operation(renewLease);
  } finally {
    await prisma.integration.updateMany({
      where: { id: integrationId, syncLeaseId: leaseId },
      data: { syncLeaseId: null, syncLeaseExpiresAt: null }
    });
  }
}
