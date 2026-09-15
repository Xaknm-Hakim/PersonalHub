import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as listTasks, POST as createTask } from "@/app/api/v1/tasks/route";
import { PATCH } from "@/app/api/v1/tasks/[id]/route";
import { POST as complete } from "@/app/api/v1/tasks/[id]/complete/route";
import { GET as today } from "@/app/api/v1/today/route";
import { GET as upcoming } from "@/app/api/v1/upcoming/route";
import { GET as health } from "@/app/api/health/route";
import { todayDateOnly } from "@/lib/domain/dates";
import { bootstrapOwner } from "@/lib/auth/owner";
import { createApiToken, revokeApiToken } from "@/lib/auth/api-tokens";

import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";
disposableDatabase();
let authorization = "";
const request = (url: string, init: RequestInit = {}) =>
  new Request(url, {
    ...init,
    headers: { authorization, ...init.headers }
  });
describe("task API contracts against PostgreSQL", () => {
  beforeEach(async () => {
    await assertDisposableDatabase((sql) => prisma.$queryRawUnsafe(sql));
    await prisma.loginThrottle.deleteMany();
    await prisma.session.deleteMany();
    await prisma.apiToken.deleteMany();
    await prisma.owner.deleteMany();
    await prisma.note.deleteMany();
    await prisma.task.deleteMany();
    await prisma.tag.deleteMany();
    await bootstrapOwner("correct horse battery staple");
    const issued = await createApiToken({
      name: "Integration test",
      scopes: ["read", "write"]
    });
    authorization = `Bearer ${issued.plaintext}`;
  });
  afterAll(async () => prisma.$disconnect());
  it("requires a bearer token and returns redacted request errors", async () => {
    expect(
      (await listTasks(new Request("http://localhost/api/v1/tasks"))).status
    ).toBe(401);
    expect(
      (
        await listTasks(
          new Request("http://localhost/api/v1/tasks", {
            headers: { authorization: "Bearer malformed" }
          })
        )
      ).status
    ).toBe(401);
    const malformedJson = await createTask(
      request("http://localhost/api/v1/tasks", {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" }
      })
    );
    expect(malformedJson.status).toBe(400);
    expect(JSON.stringify(await malformedJson.json())).not.toMatch(
      /Prisma|postgres|password|stack/i
    );
    const readOnly = await createApiToken({
      name: "Read only",
      scopes: ["read"]
    });
    expect(
      (
        await createTask(
          request("http://localhost/api/v1/tasks", {
            method: "POST",
            body: JSON.stringify({ title: "x" }),
            headers: {
              authorization: `Bearer ${readOnly.plaintext}`,
              "content-type": "application/json"
            }
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await createTask(
          request("http://localhost/api/v1/tasks", {
            method: "POST",
            body: JSON.stringify({ title: "x" }),
            headers: { "content-type": "text/plain" }
          })
        )
      ).status
    ).toBe(415);
    const oversized = JSON.stringify({ title: "x".repeat(70_000) });
    expect(
      (
        await createTask(
          request("http://localhost/api/v1/tasks", {
            method: "POST",
            body: oversized,
            headers: { "content-type": "application/json" }
          })
        )
      ).status
    ).toBe(413);
  });

  it("returns redacted validation/not-found responses and completes idempotently", async () => {
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

  it("rejects revoked bearer tokens while leaving health public and non-sensitive", async () => {
    const id = (await prisma.apiToken.findFirstOrThrow()).id;
    await revokeApiToken(id);
    expect((await today(request("http://localhost/api/v1/today"))).status).toBe(
      401
    );
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
