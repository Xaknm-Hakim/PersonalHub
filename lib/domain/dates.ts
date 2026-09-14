/** Date-only values are normalized to UTC midnight, so client time zones cannot shift a planning day. */
export function parseDateOnly(value: unknown, field = "date"): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ValidationError({ [field]: "Use a real YYYY-MM-DD date." });
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError({ [field]: "Use a real calendar date." });
  }
  return date;
}

export function dateOnly(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function todayDateOnly(
  now = new Date(),
  timeZone = process.env.PERSONALHUB_TIME_ZONE || "Asia/Kuala_Lumpur"
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

/** Return a new UTC date-only value; never mutates the input. */
export function addDays(date: Date, days: number) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
/** Return a new UTC date-only value; month-end is clamped (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: Date, months: number) {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
  result.setUTCDate(
    Math.min(
      date.getUTCDate(),
      new Date(
        Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
      ).getUTCDate()
    )
  );
  return result;
}

export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Please correct the highlighted fields.");
    this.name = "ValidationError";
  }
}
