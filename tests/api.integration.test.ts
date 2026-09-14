import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as listTasks, POST as createTask } from "@/app/api/v1/tasks/route";
import { PATCH } from "@/app/api/v1/tasks/[id]/route";
import { POST as complete } from "@/app/api/v1/tasks/[id]/complete/route";
import { GET as today } from "@/app/api/v1/today/route";
import { GET as upcoming } from "@/app/api/v1/upcoming/route";
import { todayDateOnly } from "@/lib/domain/dates";

import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";
disposableDatabase();
const request = (url: string, init: RequestInit = {}) =>
  new Request(url, {
    ...init,
    headers: { host: "localhost", ...init.headers }
  });
describe("task API contracts against PostgreSQL", () => {
  beforeEach(async () => {
    await assertDisposableDatabase((sql) => prisma.$queryRawUnsafe(sql));
    await prisma.note.deleteMany();
    await prisma.task.deleteMany();
    await prisma.tag.deleteMany();
  });
  afterAll(async () => prisma.$disconnect());
  it("returns redacted validation/not-found responses, rejects foreign origins, and completes idempotently", async () => {
    expect(
      (
        await createTask(
          request("http://localhost/api/v1/tasks", {
            method: "POST",
            body: "null",
            headers: { host: "localhost", "content-type": "application/json" }
          })
        )
      ).status
    ).toBe(422);
    expect(
      (
        await createTask(
          request("http://localhost/api/v1/tasks", {
            method: "POST",
            body: JSON.stringify({ title: "x", private: "no" }),
            headers: { host: "localhost", "content-type": "application/json" }
          })
        )
      ).status
    ).toBe(422);
    expect(
      (
        await createTask(
          request("http://localhost/api/v1/tasks", {
            method: "POST",
            body: JSON.stringify({ title: "x" }),
            headers: {
              host: "localhost",
              origin: "http://evil.example",
              "content-type": "application/json"
            }
          })
        )
      ).status
    ).toBe(403);
    const created = await createTask(
      request("http://localhost/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "x" }),
        headers: { host: "localhost", "content-type": "application/json" }
      })
    );
    expect(created.status).toBe(201);
    const id = (await created.json()).data.id as string;
    expect(
      (
        await PATCH(
          request(`http://localhost/api/v1/tasks/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ priority: "high" }),
            headers: { host: "localhost", "content-type": "application/json" }
          }),
          { params: Promise.resolve({ id }) }
        )
      ).status
    ).toBe(200);
    const first = await complete(
      request(`http://localhost/api/v1/tasks/${id}/complete`, {
        method: "POST"
      }),
      { params: Promise.resolve({ id }) }
    );
    const timestamp = (await first.json()).data.completedAt;
    const second = await complete(
      request(`http://localhost/api/v1/tasks/${id}/complete`, {
        method: "POST"
      }),
      { params: Promise.resolve({ id }) }
    );
    expect((await second.json()).data.completedAt).toBe(timestamp);
    const missing = await PATCH(
      request("http://localhost/api/v1/tasks/missing", {
        method: "PATCH",
        body: "{}",
        headers: { host: "localhost", "content-type": "application/json" }
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    expect(missing.status).toBe(404);
    expect(JSON.stringify(await missing.json())).not.toMatch(
      /Prisma|postgres|password/i
    );
  });

  it("rejects invalid task query enums and exposes normalized assignment and milestone planning DTOs", async () => {
    expect(
      (await listTasks(request("http://localhost/api/v1/tasks?status=bogus")))
        .status
    ).toBe(422);
    await prisma.assignment.create({
      data: {
        courseCode: "CS103",
        courseName: "Networks",
        title: "Quiz",
        deadline: new Date("2026-09-11T00:00:00.000Z"),
        priority: "high"
      }
    });
    await prisma.project.create({
      data: {
        title: "Milestone",
        status: "active",
        priority: "medium",
        targetDate: new Date("2026-09-11T00:00:00.000Z")
      }
    });
    const date = todayDateOnly();
    await prisma.assignment.updateMany({ data: { deadline: date } });
    await prisma.project.updateMany({ data: { targetDate: date } });
    const response = await today(request("http://localhost/api/v1/today"));
    const body = await response.json();
    expect(body.data.today).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: "assignment", event: "deadline" }),
        expect.objectContaining({ entity: "project", event: "target" })
      ])
    );
    expect(
      (await upcoming(request("http://localhost/api/v1/upcoming"))).status
    ).toBe(200);
  });
});
