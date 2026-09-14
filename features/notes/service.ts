import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/domain/dates";
import { id, parse, tagIds, validationError } from "@/lib/domain/validation";
const required = z.string().trim().min(1, "Required");
const schema = z
  .object({
    title: required.max(300),
    body: required.max(50000),
    linkedTaskId: id.optional().nullable(),
    linkedAssignmentId: id.optional().nullable(),
    projectId: id.optional().nullable(),
    tagIds: tagIds.optional().default([])
  })
  .strict();
export type NoteInput = z.input<typeof schema>;
export function validateNoteInput(input: unknown) {
  const r = schema.safeParse(input);
  if (!r.success) throw validationError(r.error);
  return {
    ...r.data,
    linkedTaskId: r.data.linkedTaskId || null,
    linkedAssignmentId: r.data.linkedAssignmentId || null,
    projectId: r.data.projectId || null
  };
}
async function related(
  client: Prisma.TransactionClient,
  data: ReturnType<typeof validateNoteInput>
) {
  const [task, assignment, project, tagCount] = await Promise.all([
    data.linkedTaskId
      ? client.task.count({ where: { id: data.linkedTaskId } })
      : 1,
    data.linkedAssignmentId
      ? client.assignment.count({ where: { id: data.linkedAssignmentId } })
      : 1,
    data.projectId
      ? client.project.count({ where: { id: data.projectId } })
      : 1,
    data.tagIds.length
      ? client.tag.count({ where: { id: { in: data.tagIds } } })
      : 0
  ]);
  if (
    !task ||
    !assignment ||
    !project ||
    (data.tagIds.length && tagCount !== new Set(data.tagIds).size)
  )
    throw new ValidationError({
      relationships: "A selected link or tag was not found."
    });
}
export async function createNote(input: unknown) {
  const data = validateNoteInput(input);
  const { tagIds: ids, ...note } = data;
  return prisma.$transaction(async (tx) => {
    await related(tx, data);
    return tx.note.create({
      data: { ...note, tags: { connect: ids.map((tagId) => ({ id: tagId })) } }
    });
  });
}
export async function updateNote(idValue: string, input: unknown) {
  const data = validateNoteInput(input);
  const safeId = parse(id, idValue);
  const { tagIds: ids, ...note } = data;
  return prisma.$transaction(async (tx) => {
    if (!(await tx.note.count({ where: { id: safeId } }))) return null;
    await related(tx, data);
    return tx.note.update({
      where: { id: safeId },
      data: { ...note, tags: { set: ids.map((tagId) => ({ id: tagId })) } }
    });
  });
}
export async function deleteNote(idValue: string) {
  const safeId = parse(id, idValue);
  const n = await prisma.note.findUnique({ where: { id: safeId } });
  if (!n) return null;
  await prisma.note.delete({ where: { id: safeId } });
  return n;
}
export const findNotes = (q?: string, tagId?: string) =>
  prisma.note.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(tagId ? { tags: { some: { id: tagId } } } : {})
    },
    include: {
      linkedTask: true,
      linkedAssignment: true,
      project: true,
      tags: true
    },
    orderBy: { updatedAt: "desc" }
  });
export const noteById = (idValue: string) =>
  prisma.note.findUnique({
    where: { id: parse(id, idValue) },
    include: { tags: true }
  });
