import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { encryptIntegrationCredential } from "@/services/integrations/credential-crypto";
import {
  syncGoogleCalendar,
  type GoogleCalendarGateway,
  type GoogleEventProjection
} from "@/services/integrations/google/sync";
import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";

disposableDatabase();
const encryptionKey = randomBytes(32).toString("base64");

class FakeGoogle implements GoogleCalendarGateway {
  calendars = new Map<
    string,
    { summary: string; managementMarker: string | null }
  >();
  events = new Map<string, GoogleEventProjection>();
  calendarCreates = 0;
  failNextCreate = false;
  failNextDelete = false;
  pauseCalendarCreation = false;
  calendarCreationStarted: Promise<void> = Promise.resolve();
  private signalCalendarCreationStarted: (() => void) | null = null;
  private resumeCalendarCreation: (() => void) | null = null;

  constructor() {
    this.resetCalendarCreationGate();
  }

  private resetCalendarCreationGate() {
    this.calendarCreationStarted = new Promise((resolve) => {
      this.signalCalendarCreationStarted = resolve;
    });
  }

  releaseCalendarCreation() {
    this.resumeCalendarCreation?.();
  }

  async createCalendar(summary: string, managementMarker: string) {
    this.signalCalendarCreationStarted?.();
    if (this.pauseCalendarCreation)
      await new Promise<void>((resolve) => {
        this.resumeCalendarCreation = resolve;
      });
    this.calendarCreates += 1;
    const id = `calendar-${this.calendarCreates}`;
    this.calendars.set(id, { summary, managementMarker });
    return id;
  }
  async findManagedCalendars(managementMarker: string) {
    return [...this.calendars.entries()]
      .filter(([, calendar]) => calendar.managementMarker === managementMarker)
      .map(([id]) => id)
      .sort();
  }
  async calendarExists(id: string) {
    return this.calendars.has(id);
  }
  async upsertEvent(
    _calendarId: string,
    eventId: string,
    projection: GoogleEventProjection
  ) {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error("temporary Google failure");
    }
    this.events.set(eventId, projection);
    return eventId;
  }
  async deleteEvent(_calendarId: string, eventId: string) {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error("temporary Google delete failure");
    }
    this.events.delete(eventId);
  }
}

async function connectedIntegration() {
  const integration = await prisma.integration.create({
    data: { provider: "google", status: "connected", connectedAt: new Date() }
  });
  return prisma.integration.update({
    where: { id: integration.id },
    data: {
      encryptedRefreshToken: encryptIntegrationCredential(
        "refresh-token",
        encryptionKey,
        { integrationId: integration.id, provider: "google" }
      )
    }
  });
}

describe("manual Google Calendar projection", () => {
  beforeEach(async () => {
    await assertDisposableDatabase((sql) => prisma.$queryRawUnsafe(sql));
    await prisma.externalResource.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.task.deleteMany();
    await prisma.assignment.deleteMany();
  });
  afterAll(async () => prisma.$disconnect());

  it("creates one calendar and idempotently projects one task and assignment", async () => {
    await connectedIntegration();
    const task = await prisma.task.create({
      data: { title: "Dated task", dueDate: new Date("2026-10-01") }
    });
    const assignment = await prisma.assignment.create({
      data: {
        courseCode: "CS101",
        courseName: "Systems",
        title: "Dated assignment",
        deadline: new Date("2026-10-02")
      }
    });
    await prisma.task.create({ data: { title: "Undated task" } });
    const google = new FakeGoogle();

    const first = await syncGoogleCalendar(google);
    const second = await syncGoogleCalendar(google);

    expect(first).toMatchObject({ created: 2, updated: 0, deleted: 0 });
    expect(second).toMatchObject({ created: 0, updated: 2, deleted: 0 });
    expect(google.calendarCreates).toBe(1);
    expect(google.events).toHaveLength(2);
    expect(await prisma.externalResource.count()).toBe(2);
    expect([...google.events.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          summary: "Task: Dated task",
          startDate: "2026-10-01",
          endDate: "2026-10-02",
          localEntityId: task.id
        }),
        expect.objectContaining({
          summary: "Assignment: Dated assignment",
          startDate: "2026-10-02",
          endDate: "2026-10-03",
          localEntityId: assignment.id
        })
      ])
    );
  });

  it("updates existing events and removes only no-longer-eligible managed events", async () => {
    await connectedIntegration();
    const task = await prisma.task.create({
      data: { title: "Original", dueDate: new Date("2026-10-01") }
    });
    const google = new FakeGoogle();
    await syncGoogleCalendar(google);
    google.events.set("unrelated", {
      summary: "Unrelated",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      localEntityType: "other",
      localEntityId: "other"
    });

    await prisma.task.update({
      where: { id: task.id },
      data: { title: "Changed", dueDate: new Date("2026-10-04") }
    });
    await syncGoogleCalendar(google);
    expect(
      [...google.events.values()].find(
        (event) => event.localEntityId === task.id
      )
    ).toMatchObject({
      summary: "Task: Changed",
      startDate: "2026-10-04",
      endDate: "2026-10-05"
    });

    await prisma.task.update({
      where: { id: task.id },
      data: { status: "done", completedAt: new Date() }
    });
    const result = await syncGoogleCalendar(google);
    expect(result.deleted).toBe(1);
    expect(google.events.has("unrelated")).toBe(true);
    expect(await prisma.externalResource.count()).toBe(0);
  });

  it("records partial failure and converges safely on the next sync", async () => {
    await connectedIntegration();
    await prisma.task.create({
      data: { title: "Retry me", dueDate: new Date("2026-10-01") }
    });
    const google = new FakeGoogle();
    google.failNextCreate = true;
    await expect(syncGoogleCalendar(google)).rejects.toMatchObject({
      code: "PARTIAL_FAILURE"
    });
    expect(await prisma.externalResource.count()).toBe(0);

    await expect(syncGoogleCalendar(google)).resolves.toMatchObject({
      created: 1,
      failed: 0
    });
    expect(google.events).toHaveLength(1);
    expect(await prisma.externalResource.count()).toBe(1);
  });

  it("rediscovers a marked calendar after the remote-create persistence gap", async () => {
    const integration = await connectedIntegration();
    const google = new FakeGoogle();
    google.calendars.set("recovered-calendar", {
      summary: "PersonalHub",
      managementMarker: `personalhub-integration:${integration.id}`
    });

    await syncGoogleCalendar(google);

    expect(google.calendarCreates).toBe(0);
    expect(
      await prisma.integration.findUniqueOrThrow({
        where: { id: integration.id }
      })
    ).toMatchObject({ externalCalendarId: "recovered-calendar" });
  });

  it("does not adopt a title-only calendar and refuses ambiguous managed calendars", async () => {
    const integration = await connectedIntegration();
    const google = new FakeGoogle();
    google.calendars.set("user-calendar", {
      summary: "PersonalHub",
      managementMarker: null
    });
    await syncGoogleCalendar(google);
    expect(google.calendarCreates).toBe(1);
    expect(
      (
        await prisma.integration.findUniqueOrThrow({
          where: { id: integration.id }
        })
      ).externalCalendarId
    ).not.toBe("user-calendar");

    await prisma.integration.update({
      where: { id: integration.id },
      data: { externalCalendarId: null }
    });
    const marker = `personalhub-integration:${integration.id}`;
    google.calendars.set("duplicate-managed", {
      summary: "PersonalHub",
      managementMarker: marker
    });
    await expect(syncGoogleCalendar(google)).rejects.toMatchObject({
      code: "MULTIPLE_MANAGED_CALENDARS"
    });
  });

  it("allows one lease winner, cleans the lease, and reclaims an expired lease", async () => {
    const integration = await connectedIntegration();
    const google = new FakeGoogle();
    google.pauseCalendarCreation = true;
    const first = syncGoogleCalendar(google);
    await google.calendarCreationStarted;

    await expect(syncGoogleCalendar(google)).rejects.toMatchObject({
      code: "SYNC_IN_PROGRESS"
    });
    google.releaseCalendarCreation();
    await first;
    expect(google.calendarCreates).toBe(1);
    expect(
      await prisma.integration.findUniqueOrThrow({
        where: { id: integration.id }
      })
    ).toMatchObject({ syncLeaseId: null, syncLeaseExpiresAt: null });

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        syncLeaseId: "abandoned",
        syncLeaseExpiresAt: new Date(Date.now() - 1_000)
      }
    });
    google.pauseCalendarCreation = false;
    await expect(syncGoogleCalendar(google)).resolves.toMatchObject({
      failed: 0
    });
  });

  it("resumes deletion failures and never removes unrelated events", async () => {
    await connectedIntegration();
    const task = await prisma.task.create({
      data: { title: "Delete projection", dueDate: new Date("2026-10-01") }
    });
    const google = new FakeGoogle();
    await syncGoogleCalendar(google);
    google.events.set("unrelated", {
      summary: "Unrelated",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      localEntityType: "other",
      localEntityId: "other"
    });
    await prisma.task.delete({ where: { id: task.id } });
    google.failNextDelete = true;

    await expect(syncGoogleCalendar(google)).rejects.toMatchObject({
      code: "PARTIAL_FAILURE"
    });
    expect(await prisma.externalResource.count()).toBe(1);
    await syncGoogleCalendar(google);
    expect(await prisma.externalResource.count()).toBe(0);
    expect(google.events.has("unrelated")).toBe(true);
  });

  it("removes a projection when its date is cleared and overwrites Google-side edits", async () => {
    await connectedIntegration();
    const task = await prisma.task.create({
      data: { title: "Canonical", dueDate: new Date("2026-10-01") }
    });
    const google = new FakeGoogle();
    await syncGoogleCalendar(google);
    const [managedId] = [...google.events.keys()];
    google.events.set(managedId, {
      ...google.events.get(managedId)!,
      summary: "Edited in Google"
    });
    await syncGoogleCalendar(google);
    expect(google.events.get(managedId)?.summary).toBe("Task: Canonical");

    await prisma.task.update({
      where: { id: task.id },
      data: { dueDate: null }
    });
    await syncGoogleCalendar(google);
    expect(google.events.has(managedId)).toBe(false);
  });
});
