import { planningAttention } from "@/features/planning/service";

/** Compatibility API projection; each array contains the shared PlanningItem DTO. */
export async function planningItems(now = new Date()) {
  const attention = await planningAttention(now);
  const byEntity = (
    items: typeof attention.today,
    entity: "task" | "assignment" | "project"
  ) => items.filter((item) => item.entity === entity);
  return {
    today: {
      tasks: byEntity(attention.today, "task"),
      assignments: byEntity(attention.today, "assignment"),
      projects: byEntity(attention.today, "project")
    },
    overdue: {
      tasks: byEntity(attention.overdue, "task"),
      assignments: byEntity(attention.overdue, "assignment"),
      projects: byEntity(attention.overdue, "project")
    },
    upcoming: {
      tasks: byEntity(attention.comingSoon, "task"),
      assignments: byEntity(attention.comingSoon, "assignment"),
      projects: byEntity(attention.comingSoon, "project")
    }
  };
}
