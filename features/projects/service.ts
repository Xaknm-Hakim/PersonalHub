import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, ValidationError } from "@/lib/domain/dates";
import { priorities, projectStatuses, projectTypes } from "@/lib/domain/status";
import { httpUrl, id, parse, validationError } from "@/lib/domain/validation";
const required = z.string().trim().min(1, "Required");
const optional = z
  .string()
  .trim()
  .max(10000)
  .optional()
  .nullable()
  .transform((v) => v || null);
const url = httpUrl
  .nullable()
  .optional()
  .transform((value) => value || null);
const schema = z
  .object({
    title: required.max(300),
    description: optional,
    status: z.enum(projectStatuses).default("planned"),
    type: z.enum(projectTypes).default("other"),
    priority: z.enum(priorities).default("medium"),
    startDate: z.string().optional().nullable(),
    targetDate: z.string().optional().nullable(),
    completedAt: z.string().optional().nullable(),
    repositoryUrl: url,
    localPath: optional,
    liveUrl: url,
    techStack: optional,
    objective: optional,
    currentProgress: optional,
    nextAction: optional,
    lessonsLearned: optional
  })
  .strict();
export type ProjectInput = z.input<typeof schema>;
export function validateProjectInput(input: unknown) {
  const r = schema.safeParse(input);
  if (!r.success) throw validationError(r.error);
  const startDate = parseDateOnly(r.data.startDate, "startDate"),
    targetDate = parseDateOnly(r.data.targetDate, "targetDate"),
    completedAt = parseDateOnly(r.data.completedAt, "completedAt");
  if (startDate && targetDate && startDate > targetDate)
    throw new ValidationError({
      targetDate: "Target date cannot be before start date."
    });
  if (r.data.status === "completed" && !completedAt)
    throw new ValidationError({
      completedAt: "Completed projects require a completion date."
    });
  return { ...r.data, startDate, targetDate, completedAt };
}
export const createProject = (input: unknown) =>
  prisma.project.create({ data: validateProjectInput(input) });
export async function updateProject(idValue: string, input: unknown) {
  const safeId = parse(id, idValue);
  if (!(await prisma.project.count({ where: { id: safeId } }))) return null;
  return prisma.project.update({
    where: { id: safeId },
    data: validateProjectInput(input)
  });
}
export async function deleteProject(idValue: string) {
  const safeId = parse(id, idValue);
  const p = await prisma.project.findUnique({ where: { id: safeId } });
  if (!p) return null;
  await prisma.project.delete({ where: { id: safeId } });
  return p;
}
export async function findProjects(
  filters: {
    status?: string;
    type?: string;
    priority?: string;
    q?: string;
    sort?: string;
  } = {}
) {
  const orderBy =
    filters.sort === "title"
      ? { title: "asc" as const }
      : filters.sort === "start_date"
        ? { startDate: "asc" as const }
        : filters.sort === "target_date"
          ? { targetDate: "asc" as const }
          : { updatedAt: "desc" as const };
  return prisma.project.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
              { nextAction: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      tasks: { include: { tags: true }, orderBy: { dueDate: "asc" } },
      notes: true
    },
    orderBy
  });
}
export const projectById = (idValue: string) =>
  prisma.project.findUnique({
    where: { id: parse(id, idValue) },
    include: { tasks: { include: { tags: true } }, notes: true }
  });
export const projectDateDto = (project: {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  targetDate: Date | null;
  completedAt: Date | null;
}) => ({
  id: project.id,
  title: project.title,
  status: project.status,
  startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
  targetDate: project.targetDate?.toISOString().slice(0, 10) ?? null,
  completedAt: project.completedAt?.toISOString() ?? null
});
