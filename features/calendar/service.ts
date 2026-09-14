import { planningQuery, type PlanningItem } from "@/features/planning/service";

export async function calendarItems(
  start: Date,
  end: Date,
  filters: { type?: string; status?: string } = {}
) {
  const entries = await planningQuery({ start, end });
  return entries.filter(
    (entry) =>
      (!filters.type || entry.entity === filters.type) &&
      (!filters.status || entry.status === filters.status)
  );
}

export type CalendarItem = PlanningItem;
