import { dateOnly, parseDateOnly } from "@/lib/domain/dates";
import { isClosed, isProjectClosed } from "@/lib/domain/status";

export type PlanningEntity = "task" | "assignment" | "project";

/** A planning day is always a YYYY-MM-DD key, never a browser-local Date string. */
export function planningDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  return dateOnly(new Date(value));
}

export function parsePlanningMonth(value?: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return parseDateOnly(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`
  );
}

export function isOverduePlanningDate(
  date: string | null,
  entity: PlanningEntity,
  status: string,
  today: string
) {
  return Boolean(date && !isClosed(entity, status) && date < today);
}

export function projectNeedsNextStep(input: {
  status: string;
  nextAction: string | null;
  openTaskCount: number;
}) {
  return (
    !isProjectClosed(input.status) &&
    !input.nextAction?.trim() &&
    input.openTaskCount === 0
  );
}
