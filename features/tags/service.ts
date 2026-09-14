import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/domain/dates";
import { id, parse, validationError } from "@/lib/domain/validation";
const schema = z
  .object({
    name: z.string().trim().min(1, "Required").max(80),
    color: z
      .string()
      .trim()
      .max(32)
      .optional()
      .nullable()
      .transform((v) => v || null)
  })
  .strict();
export const findTags = () =>
  prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { tasks: true, assignments: true, notes: true } }
    }
  });
const isUniqueError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "P2002";
export async function createTag(input: unknown) {
  const r = schema.safeParse(input);
  if (!r.success) throw validationError(r.error);
  try {
    return await prisma.tag.create({ data: r.data });
  } catch (error: unknown) {
    if (isUniqueError(error))
      throw new ValidationError({ name: "That tag already exists." });
    throw error;
  }
}
export async function updateTag(idValue: string, input: unknown) {
  const safeId = parse(id, idValue);
  const r = schema.safeParse(input);
  if (!r.success) throw validationError(r.error);
  try {
    if (!(await prisma.tag.count({ where: { id: safeId } }))) return null;
    return await prisma.tag.update({ where: { id: safeId }, data: r.data });
  } catch (error: unknown) {
    if (isUniqueError(error))
      throw new ValidationError({ name: "That tag already exists." });
    throw error;
  }
}
export async function deleteTag(idValue: string) {
  const safeId = parse(id, idValue);
  const item = await prisma.tag.findUnique({ where: { id: safeId } });
  if (!item) return null;
  await prisma.tag.delete({ where: { id: safeId } });
  return item;
}
