import type { Prisma, Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type { Project };

export type ProjectFilters = {
  status?: string;
  type?: string;
  priority?: string;
  sort?: string;
  take?: number;
};

function projectOrder(sort?: string): Prisma.ProjectOrderByWithRelationInput[] {
  if (sort === "start_date")
    return [
      { startDate: { sort: "asc", nulls: "last" } },
      { updatedAt: "desc" }
    ];
  if (sort === "target_date")
    return [
      { targetDate: { sort: "asc", nulls: "last" } },
      { updatedAt: "desc" }
    ];
  if (sort === "title") return [{ title: "asc" }];
  return [{ updatedAt: "desc" }];
}

export function findProjects(filters: ProjectFilters = {}) {
  return prisma.project.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.priority ? { priority: filters.priority } : {})
    },
    orderBy: projectOrder(filters.sort),
    take: filters.take
  });
}

export function findProjectById(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

export function countProjectsByStatus(status: string) {
  return prisma.project.count({ where: { status } });
}

export function findTimelineProjects() {
  return prisma.project.findMany({
    where: {
      startDate: { not: null },
      OR: [{ targetDate: { not: null } }, { completedAt: { not: null } }]
    },
    orderBy: { startDate: "asc" }
  });
}

export function findProjectTargetsBetween(start: Date, end: Date) {
  return prisma.project.findMany({
    where: { targetDate: { gte: start, lte: end } }
  });
}

export function findProjectCompletionsBetween(start: Date, end: Date) {
  return prisma.project.findMany({
    where: { completedAt: { gte: start, lte: end } }
  });
}
