import { addDays, addMonths, todayDateOnly } from "@/lib/domain/dates";
import { parsePlanningMonth } from "@/features/planning/semantics";
import { planningQuery, type PlanningItem } from "@/features/planning/service";

export type TimelineFilters = {
  month?: string;
  range?: string;
  type?: string;
  status?: string;
};
export async function timelineItems(filters: TimelineFilters = {}) {
  const today = todayDateOnly();
  const month =
    parsePlanningMonth(filters.month) ??
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const start =
    filters.range === "this_week"
      ? addDays(today, -today.getUTCDay())
      : filters.range === "all"
        ? undefined
        : month;
  const end =
    filters.range === "this_week"
      ? addDays(start!, 6)
      : filters.range === "all"
        ? undefined
        : addDays(addMonths(month, 1), -1);
  const entries = await planningQuery({ start, end });
  return {
    start,
    end,
    month,
    items: entries.filter(
      (x) =>
        (!filters.type || x.entity === filters.type) &&
        (!filters.status || x.status === filters.status)
    )
  } as { start?: Date; end?: Date; month: Date; items: PlanningItem[] };
}
