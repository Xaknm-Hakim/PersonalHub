import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import {
  createAssignment,
  updateAssignment
} from "@/features/assignments/service";
import { createNote, updateNote } from "@/features/notes/service";
import { completeTask, createTask, updateTask } from "@/features/tasks/service";
import {
  deleteTaskAction,
  quickCaptureTaskAction,
  updateTaskAction
} from "@/app/tasks/actions";

import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";
disposableDatabase();
describe("domain mutations against PostgreSQL", () => {
  beforeEach(async () => {
    await assertDisposableDatabase((sql) => prisma.$queryRawUnsafe(sql));
    await prisma.note.deleteMany();
    await prisma.task.deleteMany();
    await prisma.assignment.deleteMany();
    await prisma.project.deleteMany();
    await prisma.tag.deleteMany();
  });
  afterAll(async () => prisma.$disconnect());

  it("writes relation mutations without leaking tagIds into Prisma data and preserves PATCH fields", async () => {
    const tag = await prisma.tag.create({ data: { name: "integration" } });
    const task = await createTask({
      title: "Keep me",
      dueDate: "2026-09-10",
      tagIds: [tag.id]
    });
    const patched = await updateTask(task.id, { priority: "urgent" });
    expect(patched).toMatchObject({ title: "Keep me", priority: "urgent" });
    expect(patched?.tags.map((item) => item.id)).toEqual([tag.id]);
    expect(patched?.completedAt).toBeNull();
    const done = await updateTask(task.id, { status: "done" });
    expect(done?.completedAt).toBeInstanceOf(Date);

    const assignment = await createAssignment({
      courseCode: "CS101",
      courseName: "Computer Science",
      title: "Lab",
      deadline: "2026-09-11",
      tagIds: [tag.id]
    });
    expect(
      (
        await updateAssignment(assignment.id, {
          courseCode: "CS101",
          courseName: "Computer Science",
          title: "Lab",
          deadline: "2026-09-11",
          tagIds: [tag.id]
        })
      )?.id
    ).toBe(assignment.id);
    const note = await createNote({
      title: "N",
      body: "B",
      linkedTaskId: task.id,
      tagIds: [tag.id]
    });
    expect(
      (
        await updateNote(note.id, {
          title: "N2",
          body: "B",
          linkedTaskId: task.id,
          tagIds: [tag.id]
        })
      )?.title
    ).toBe("N2");
  });

  it("validates PATCH dates against stored fields and preserves sparse values and historical completion policy", async () => {
    const task = await createTask({
      title: "Dates",
      description: "keep",
      startDate: "2026-09-10",
      dueDate: "2026-09-12"
    });
    await expect(
      updateTask(task.id, { dueDate: "2026-09-09" })
    ).rejects.toMatchObject({ fields: { dueDate: expect.any(String) } });
    expect((await updateTask(task.id, { priority: "low" }))?.description).toBe(
      "keep"
    );

    const createdDone = await createTask({
      title: "Done at creation",
      status: "done"
    });
    expect(createdDone.completedAt).toBeInstanceOf(Date);
    const legacy = await prisma.task.create({
      data: { title: "legacy done", status: "done", priority: "medium" }
    });
    expect((await completeTask(legacy.id))?.completedAt).toBeNull();
  });

  it("records assignment completion only for completed, not merely closed, states", async () => {
    const assignment = await createAssignment({
      courseCode: "CS102",
      courseName: "Systems",
      title: "Submission",
      deadline: "2026-09-11",
      status: "submitted"
    });
    expect(assignment.completedAt).toBeNull();
    const completed = await updateAssignment(assignment.id, {
      courseCode: "CS102",
      courseName: "Systems",
      title: "Submission",
      deadline: "2026-09-11",
      status: "completed"
    });
    expect(completed?.completedAt).toBeInstanceOf(Date);
  });

  it("returns a distinct success identity for repeated quick captures", async () => {
    const form = () => {
      const data = new FormData();
      data.set("title", "Repeated title");
      return data;
    };
    const first = await quickCaptureTaskAction({}, form());
    const second = await quickCaptureTaskAction(first, form());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.resultId).toEqual(expect.any(String));
    expect(second.resultId).not.toBe(first.resultId);
  });

  it("returns a distinct success identity for every repeated edit and reports stale deletes", async () => {
    const task = await createTask({ title: "First title" });
    const form = (title: string) => {
      const data = new FormData();
      data.set("id", task.id);
      data.set("title", title);
      return data;
    };

    const first = await updateTaskAction({}, form("Second title"));
    const second = await updateTaskAction(first, form("Third title"));
    expect(first.ok).toBe(true);
    expect(first.resultId).toEqual(expect.any(String));
    expect(second.ok).toBe(true);
    expect(second.resultId).not.toBe(first.resultId);

    const stale = new FormData();
    stale.set("id", "missing-task");
    await expect(deleteTaskAction(stale)).resolves.toEqual({
      ok: false,
      message: "This task no longer exists."
    });
  });
});
