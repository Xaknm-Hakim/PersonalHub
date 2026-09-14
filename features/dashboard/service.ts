import { prisma } from "@/lib/prisma";
import { closedTaskStatuses } from "@/lib/domain/status";
import {
  planningAttention,
  type PlanningItem
} from "@/features/planning/service";
import { projectNeedsNextStep } from "@/features/planning/semantics";

/** A project is stale after 14 days without an update; paused projects remain visible immediately. */
export const STALE_PROJECT_AGE_DAYS = 14;

export async function dashboardData(now = new Date()) {
  const staleBefore = new Date(
    now.getTime() - STALE_PROJECT_AGE_DAYS * 86_400_000
  );
  const [
    attention,
    candidates,
    staleOrPausedProjects,
    recentNotes,
    tasks,
    assignments,
    projects
  ] = await Promise.all([
    planningAttention(now),
    prisma.project.findMany({
      where: { status: { notIn: ["completed", "archived", "abandoned"] } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        nextAction: true,
        updatedAt: true,
        _count: {
          select: {
            tasks: { where: { status: { notIn: [...closedTaskStatuses] } } }
          }
        }
      },
      orderBy: { updatedAt: "asc" }
    }),
    prisma.project.findMany({
      where: {
        OR: [
          { status: "paused" },
          {
            updatedAt: { lt: staleBefore },
            status: { notIn: ["completed", "archived", "abandoned"] }
          }
        ]
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true
      },
      orderBy: { updatedAt: "asc" },
      take: 6
    }),
    prisma.note.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, body: true, updatedAt: true }
    }),
    prisma.task.findMany({
      where: { completedAt: { not: null } },
      select: { id: true, title: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 6
    }),
    prisma.assignment.findMany({
      where: { completedAt: { not: null } },
      select: { id: true, title: true, courseCode: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 6
    }),
    prisma.project.findMany({
      where: { completedAt: { not: null } },
      select: { id: true, title: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 6
    })
  ]);
  const recentCompleted = [
    ...tasks.map((x) => ({
      id: x.id,
      title: x.title,
      href: `/tasks?edit=${x.id}`,
      completedAt: x.completedAt!,
      entity: "Task"
    })),
    ...assignments.map((x) => ({
      id: x.id,
      title: `${x.courseCode}: ${x.title}`,
      href: `/assignments?edit=${x.id}`,
      completedAt: x.completedAt!,
      entity: "Assignment"
    })),
    ...projects.map((x) => ({
      id: x.id,
      title: x.title,
      href: `/projects?edit=${x.id}`,
      completedAt: x.completedAt!,
      entity: "Project"
    }))
  ]
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, 6);
  return {
    ...attention,
    projectsNeedingSteps: candidates
      .filter((x) =>
        projectNeedsNextStep({ ...x, openTaskCount: x._count.tasks })
      )
      .slice(0, 6),
    staleOrPausedProjects,
    recentNotes,
    recentCompleted
  } as {
    todayDate: string;
    today: PlanningItem[];
    overdue: PlanningItem[];
    comingSoon: PlanningItem[];
    projectsNeedingSteps: typeof candidates;
    staleOrPausedProjects: typeof staleOrPausedProjects;
    recentNotes: typeof recentNotes;
    recentCompleted: typeof recentCompleted;
  };
}
