import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  dateOnly,
  parseDateOnly,
  todayDateOnly,
  ValidationError
} from "@/lib/domain/dates";
import { id, parse, tagIds } from "@/lib/domain/validation";
import { priorities, taskStatuses } from "@/lib/domain/status";

const text = z.string().trim().min(1, "Required");
const optionalText = z
  .string()
  .trim()
  .max(10000)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));
const fields = {
  title: text.max(300),
  description: optionalText,
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(priorities).optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  projectId: id.nullable().optional(),
  tagIds: tagIds.optional()
};
const createSchema = z.object(fields).strict();
const patchSchema = z.object(fields).partial().strict();
export type TaskInput = z.input<typeof createSchema>;
export type TaskPatch = z.input<typeof patchSchema>;
function normalize(input: unknown, patch = false) {
  const data = parse(patch ? patchSchema : createSchema, input) as Record<
    string,
    unknown
  >;
  const result: Record<string, unknown> = { ...data };
  if (!patch || "status" in result) result.status ??= "todo";
  if (!patch || "priority" in result) result.priority ??= "medium";
  if (!patch || "startDate" in result)
    result.startDate = parseDateOnly(result.startDate, "startDate");
  if (!patch || "dueDate" in result)
    result.dueDate = parseDateOnly(result.dueDate, "dueDate");
  if (
    result.startDate instanceof Date &&
    result.dueDate instanceof Date &&
    result.startDate > result.dueDate
  )
    throw new ValidationError({
      dueDate: "Due date cannot be before start date."
    });
  if ("projectId" in result) result.projectId = result.projectId || null;
  return result as {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    startDate?: Date | null;
    dueDate?: Date | null;
    projectId?: string | null;
    tagIds?: string[];
  };
}
export const validateTaskInput = (input: unknown) => normalize(input);
async function relations(
  client: Prisma.TransactionClient,
  projectId: string | null | undefined,
  ids: string[] | undefined
) {
  if (projectId && !(await client.project.count({ where: { id: projectId } })))
    throw new ValidationError({ projectId: "Project was not found." });
  if (
    ids &&
    ids.length &&
    (await client.tag.count({ where: { id: { in: ids } } })) !== ids.length
  )
    throw new ValidationError({ tagIds: "One or more tags were not found." });
}
export async function captureTask(input: unknown) {
  const body = parse(
    z
      .object({
        title: text.max(300),
        dueDate: z.string().nullable().optional()
      })
      .strict(),
    input
  );
  return createTask({ ...body, status: "todo", priority: "medium" });
}
export async function createTask(input: unknown) {
  const data = normalize(input);
  const { tagIds: ids = [], projectId, ...task } = data;
  return prisma.$transaction(async (tx) => {
    await relations(tx, projectId, ids);
    const createData: Prisma.TaskCreateInput = {
      title: task.title!,
      ...(task.description !== undefined
        ? { description: task.description }
        : {}),
      status: task.status!,
      priority: task.priority!,
      startDate: task.startDate,
      dueDate: task.dueDate,
      completedAt: task.status === "done" ? new Date() : null,
      ...(projectId ? { project: { connect: { id: projectId } } } : {}),
      tags: { connect: ids.map((tagId) => ({ id: tagId })) }
    };
    return tx.task.create({
      data: createData,
      include: { tags: true, project: true }
    });
  });
}
export async function updateTask(idValue: string, input: unknown) {
  const safeId = parse(id, idValue);
  const patch = normalize(input, true);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: safeId } });
    if (!existing) return null;
    const startDate =
      patch.startDate === undefined ? existing.startDate : patch.startDate;
    const dueDate =
      patch.dueDate === undefined ? existing.dueDate : patch.dueDate;
    if (startDate && dueDate && startDate > dueDate)
      throw new ValidationError({
        dueDate: "Due date cannot be before start date."
      });
    await relations(tx, patch.projectId, patch.tagIds);
    const { tagIds: ids, ...data } = patch;
    const status = data.status ?? existing.status;
    const completion =
      data.status === undefined
        ? existing.completedAt
        : status === "done"
          ? existing.status === "done"
            ? existing.completedAt
            : new Date()
          : null;
    return tx.task.update({
      where: { id: safeId },
      data: {
        ...data,
        completedAt: completion,
        ...(ids === undefined
          ? {}
          : { tags: { set: ids.map((tagId) => ({ id: tagId })) } })
      },
      include: { tags: true, project: true }
    });
  });
}
export async function completeTask(idValue: string) {
  const safeId = parse(id, idValue);
  return prisma.$transaction(async (tx) => {
    const item = await tx.task.findUnique({
      where: { id: safeId },
      include: { tags: true, project: true }
    });
    if (!item) return null;
    if (item.status === "done") return item;
    return tx.task.update({
      where: { id: safeId },
      data: { status: "done", completedAt: new Date() },
      include: { tags: true, project: true }
    });
  });
}
export async function deleteTask(idValue: string) {
  const safeId = parse(id, idValue);
  const item = await prisma.task.findUnique({ where: { id: safeId } });
  if (!item) return null;
  await prisma.task.delete({ where: { id: safeId } });
  return item;
}
export async function findTasks(
  filters: {
    status?: string;
    priority?: string;
    q?: string;
    tagId?: string;
  } = {}
) {
  return prisma.task.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.tagId ? { tags: { some: { id: filters.tagId } } } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: { tags: true, project: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
  });
}
export async function taskById(idValue: string) {
  return prisma.task.findUnique({
    where: { id: parse(id, idValue) },
    include: { tags: true, project: true, notes: true }
  });
}
export async function todayAndUpcoming(now = new Date()) {
  const today = todayDateOnly(now);
  const end = addDays(today, 7);
  const open = { notIn: ["done", "cancelled"] };
  return {
    today: await prisma.task.findMany({
      where: { dueDate: today, status: open },
      include: { tags: true, project: true }
    }),
    upcoming: await prisma.task.findMany({
      where: { dueDate: { gt: today, lte: end }, status: open },
      include: { tags: true, project: true },
      orderBy: { dueDate: "asc" }
    }),
    overdue: await prisma.task.findMany({
      where: { dueDate: { lt: today }, status: open },
      include: { tags: true, project: true },
      orderBy: { dueDate: "asc" }
    })
  };
}
export const taskDto = (
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    dueDate: Date | null;
    completedAt: Date | null;
    projectId: string | null;
    tags: { id: string; name: string; color: string | null }[];
  } | null
) =>
  task && {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    startDate: dateOnly(task.startDate),
    dueDate: dateOnly(task.dueDate),
    completedAt: task.completedAt?.toISOString() ?? null,
    projectId: task.projectId,
    tags: task.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color
    }))
  };
