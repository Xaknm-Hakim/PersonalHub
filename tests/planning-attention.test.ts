import { describe, expect, it } from "vitest";
import { projectNeedsNextStep } from "@/features/planning/semantics";

describe("attention project semantics", () => {
  it("asks for a next step only with empty nextAction and no open linked tasks", () => {
    expect(
      projectNeedsNextStep({
        status: "active",
        nextAction: " ",
        openTaskCount: 0
      })
    ).toBe(true);
    expect(
      projectNeedsNextStep({
        status: "active",
        nextAction: "Ship the draft",
        openTaskCount: 0
      })
    ).toBe(false);
    expect(
      projectNeedsNextStep({
        status: "active",
        nextAction: null,
        openTaskCount: 1
      })
    ).toBe(false);
    expect(
      projectNeedsNextStep({
        status: "completed",
        nextAction: null,
        openTaskCount: 0
      })
    ).toBe(false);
  });
});
