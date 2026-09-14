import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, ValidationError } from "@/lib/domain/dates";
import {
  assignmentStatuses,
  assignmentTypes,
  priorities
} from "@/lib/domain/status";
import { id, parse, tagIds, validationError } from "@/lib/domain/validation";

const required = z.string().trim().min(1, "Required");
const optional = z
  .string()
  .trim()
  .max(10000)
  .optional()
  .nullable()
  .transform((value) => value || null);
const schema = z
  .object({
    courseCode: required.max(60),
    courseName: required.max(300),
    title: required.max(300),
    description: optional,
    type: z.enum(assignmentTypes).default("assignment"),
    status: z.enum(assignmentStatuses).default("not_started"),
    priority: z.enum(priorities).default("medium"),
    startDate: z.string().optional().nullable(),
    deadline: z.string().min(1, "Required"),
    tagIds: tagIds.optional().default([])
  })
  .strict();
export type AssignmentInput = z.input<typeof schema>;
export function validateAssignmentInput(input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error);
  const startDate = parseDateOnly(result.data.startDate, "startDate");
  const deadline = parseDateOnly(result.data.deadline, "deadline");
  if (!deadline) throw new ValidationError({ deadline: "Required" });
  if (startDate && startDate > deadline)
    throw new ValidationError({
      deadline: "Deadline cannot be before start date."
    });
  return { ...result.data, startDate, deadline };
}
async function tags(client: Prisma.TransactionClient, ids: string[]) {
  if (
    ids.length &&
    (await client.tag.count({ where: { id: { in: ids } } })) !==
      new Set(ids).size
  )
    throw new ValidationError({ tagIds: "One or more tags were not found." });
}
const completed = (status: string) => status === "completed";
export async function createAssignment(input: unknown) {
  const data = validateAssignmentInput(input);
  const { tagIds: ids, ...assignment } = data;
  return prisma.$transaction(async (tx) => {
    await tags(tx, ids);
    return tx.assignment.create({
      data: {
        ...assignment,
        tags: { connect: ids.map((tagId) => ({ id: tagId })) },
        completedAt: completed(assignment.status) ? new Date() : null
      }
    });
  });
}
export async function updateAssignment(idValue: string, input: unknown) {
  const data = validateAssignmentInput(input);
  const safeId = parse(id, idValue);
  const { tagIds: ids, ...assignment } = data;
  return prisma.$transaction(async (tx) => {
    const old = await tx.assignment.findUnique({ where: { id: safeId } });
    if (!old) return null;
    await tags(tx, ids);
    return tx.assignment.update({
      where: { id: safeId },
      data: {
        ...assignment,
        completedAt: completed(assignment.status)
          ? (old.completedAt ?? new Date())
          : null,
        tags: { set: ids.map((tagId) => ({ id: tagId })) }
      }
    });
  });
}
export async function deleteAssignment(idValue: string) {
  const safeId = parse(id, idValue);
  const old = await prisma.assignment.findUnique({ where: { id: safeId } });
  if (!old) return null;
  await prisma.assignment.delete({ where: { id: safeId } });
  return old;
}
export async function findAssignments(
  filters: {
    course?: string;
    type?: string;
    status?: string;
    priority?: string;
    q?: string;
    tagId?: string;
  } = {}
) {
  return prisma.assignment.findMany({
    where: {
      ...(filters.course ? { courseCode: filters.course } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.tagId ? { tags: { some: { id: filters.tagId } } } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { courseCode: { contains: filters.q, mode: "insensitive" } },
              { courseName: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: { tags: true },
    orderBy: { deadline: "asc" }
  });
}
export const assignmentById = (idValue: string) =>
  prisma.assignment.findUnique({
    where: { id: parse(id, idValue) },
    include: { tags: true }
  });
export const assignmentCourses = () =>
  prisma.assignment.findMany({
    select: { courseCode: true },
    distinct: ["courseCode"],
    orderBy: { courseCode: "asc" }
  });
export const assignmentDto = (item: {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  status: string;
  priority: string;
  deadline: Date;
  startDate: Date | null;
  completedAt: Date | null;
  tags: { id: string; name: string; color: string | null }[];
}) => ({
  id: item.id,
  title: item.title,
  courseCode: item.courseCode,
  courseName: item.courseName,
  status: item.status,
  priority: item.priority,
  startDate: item.startDate?.toISOString().slice(0, 10) ?? null,
  deadline: item.deadline.toISOString().slice(0, 10),
  completedAt: item.completedAt?.toISOString() ?? null,
  tags: item.tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color
  }))
});
