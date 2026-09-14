import { describe, expect, it } from "vitest";
import {
  parseDateOnly,
  todayDateOnly,
  ValidationError
} from "@/lib/domain/dates";
import { isClosed } from "@/lib/domain/status";

describe("planning date semantics", () => {
  it("normalizes a real date at UTC midnight", () =>
    expect(parseDateOnly("2026-02-28")?.toISOString()).toBe(
      "2026-02-28T00:00:00.000Z"
    ));
  it("rejects impossible dates", () =>
    expect(() => parseDateOnly("2026-02-30")).toThrow(ValidationError));
  it("does not treat legacy assignment completed as open", () =>
    expect(isClosed("assignment", "completed")).toBe(true));
  it("is stable around a local timezone boundary", () =>
    expect(
      todayDateOnly(new Date("2026-09-10T23:30:00+08:00")).toISOString()
    ).toBe("2026-09-10T00:00:00.000Z"));
});
