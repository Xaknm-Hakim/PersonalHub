import { describe, expect, it } from "vitest";
import { addMonths, parseDateOnly, todayDateOnly } from "@/lib/domain/dates";
import { isClosed } from "@/lib/domain/status";
import {
  isOverduePlanningDate,
  parsePlanningMonth,
  planningDateKey
} from "@/features/planning/semantics";

describe("shared planning semantics", () => {
  it("uses Kuala Lumpur's planning day at a UTC boundary", () => {
    expect(
      todayDateOnly(new Date("2026-09-10T16:30:00.000Z")).toISOString()
    ).toBe("2026-09-11T00:00:00.000Z");
  });

  it("parses only real months and advances leap-year months without local time math", () => {
    expect(parsePlanningMonth("2028-02")?.toISOString()).toBe(
      "2028-02-01T00:00:00.000Z"
    );
    expect(parsePlanningMonth("2028-13")).toBeNull();
    expect(addMonths(parseDateOnly("2028-01-31")!, 1).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z"
    );
  });

  it("treats legacy completed assignments as closed and never overdue", () => {
    expect(isClosed("assignment", "completed")).toBe(true);
    expect(
      isOverduePlanningDate(
        "2026-09-09",
        "assignment",
        "completed",
        "2026-09-10"
      )
    ).toBe(false);
  });

  it("compares overdue dates as date-only UTC values", () => {
    expect(
      isOverduePlanningDate("2026-09-09", "task", "todo", "2026-09-10")
    ).toBe(true);
    expect(
      isOverduePlanningDate("2026-09-10", "task", "todo", "2026-09-10")
    ).toBe(false);
    expect(planningDateKey(parseDateOnly("2026-02-28"))).toBe("2026-02-28");
  });
});
