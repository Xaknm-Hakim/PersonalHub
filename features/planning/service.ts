import { prisma } from "@/lib/prisma";
import { addDays, dateOnly, todayDateOnly } from "@/lib/domain/dates";
import { isClosed } from "@/lib/domain/status";
import { isOverduePlanningDate, type PlanningEntity } from "./semantics";

export type PlanningItem = {
  id: string;
  entity: PlanningEntity;
  event: "due" | "deadline" | "target" | "completed";
  title: string;
  date: string;
  startDate: string | null;
  status: string;
  priority: string;
  group: "Tasks" | "Assignments" | "Projects";
  href: string;
  closed: boolean;
  overdue: boolean;
  category: string | null;
};

type PlanningRange = { start?: Date; end?: Date; now?: Date };

function item(
  input: Omit<PlanningItem, "closed" | "overdue">,
  today: string
): PlanningItem {
  return {
    ...input,
    closed: isClosed(input.entity, input.status),
    overdue: isOverduePlanningDate(
      input.date,
      input.entity,
      input.status,
      today
    )
  };
}

/** One query boundary for every date-oriented surface; it returns display DTOs only. */
export async function planningQuery({
  start,
  end,
  now = new Date()
}: PlanningRange = {}): Promise<PlanningItem[]> {
  const today = dateOnly(todayDateOnly(now))!;
  const within =
    start || end
      ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
      : undefined;
  // completedAt is an instant; query through the following UTC midnight so a completion later that day is included.
  const completionWithin =
    within && end
      ? { ...(start ? { gte: start } : {}), lt: addDays(end, 1) }
      : within;
  const [tasks, assignments, targets, completions] = await Promise.all([
    prisma.task.findMany({
      where: { ...(within ? { dueDate: within } : { dueDate: { not: null } }) },
      orderBy: { dueDate: "asc" }
    }),
    prisma.assignment.findMany({
      where: { ...(within ? { deadline: within } : {}) },
      orderBy: { deadline: "asc" }
    }),
    prisma.project.findMany({
      where: {
        ...(within ? { targetDate: within } : { targetDate: { not: null } })
      },
      orderBy: { targetDate: "asc" }
    }),
    prisma.project.findMany({
      where: {
        ...(completionWithin
          ? { completedAt: completionWithin }
          : { completedAt: { not: null } })
      },
      orderBy: { completedAt: "asc" }
    })
  ]);
  return [
    ...tasks.flatMap((task) =>
      task.dueDate
        ? [
            item(
              {
                id: task.id,
                entity: "task",
                event: "due",
                title: task.title,
                date: dateOnly(task.dueDate)!,
                startDate: dateOnly(task.startDate),
                status: task.status,
                priority: task.priority,
                group: "Tasks",
                href: `/tasks?edit=${task.id}`,
                category: null
              },
              today
            )
          ]
        : []
    ),
    ...assignments.map((assignment) =>
      item(
        {
          id: assignment.id,
          entity: "assignment",
          event: "deadline",
          title: assignment.title,
          date: dateOnly(assignment.deadline)!,
          startDate: dateOnly(assignment.startDate),
          status: assignment.status,
          priority: assignment.priority,
          group: "Assignments",
          href: `/assignments?edit=${assignment.id}`,
          category: assignment.type
        },
        today
      )
    ),
    ...targets.flatMap((project) =>
      project.targetDate
        ? [
            item(
              {
                id: `${project.id}:target`,
                entity: "project",
                event: "target",
                title: project.title,
                date: dateOnly(project.targetDate)!,
                startDate: dateOnly(project.startDate),
                status: project.status,
                priority: project.priority,
                group: "Projects",
                href: `/projects?edit=${project.id}`,
                category: project.type
              },
              today
            )
          ]
        : []
    ),
    ...completions.flatMap((project) =>
      project.completedAt
        ? [
            item(
              {
                id: `${project.id}:completed`,
                entity: "project",
                event: "completed",
                title: project.title,
                date: dateOnly(project.completedAt)!,
                startDate: dateOnly(project.startDate),
                status: project.status,
                priority: project.priority,
                group: "Projects",
                href: `/projects?edit=${project.id}`,
                category: project.type
              },
              today
            )
          ]
        : []
    )
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
  );
}

export async function planningAttention(now = new Date()) {
  const todayDate = todayDateOnly(now);
  const tomorrow = addDays(todayDate, 1);
  const soonEnd = addDays(todayDate, 7);
  const [today, dueWindow] = await Promise.all([
    planningQuery({ start: todayDate, end: todayDate, now }),
    planningQuery({ start: tomorrow, end: soonEnd, now })
  ]);
  const all = await planningQuery({ end: addDays(todayDate, -1), now });
  return {
    todayDate: dateOnly(todayDate)!,
    today: today.filter(
      (entry) => entry.event !== "completed" && !entry.closed
    ),
    overdue: all.filter((entry) => entry.overdue),
    comingSoon: dueWindow.filter(
      (entry) => entry.event !== "completed" && !entry.closed
    )
  };
}
