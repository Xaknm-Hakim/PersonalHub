import { describe, expect, it } from "vitest";
import { validateAssignmentInput } from "@/features/assignments/service";
import { validateProjectInput } from "@/features/projects/service";
import { validateNoteInput } from "@/features/notes/service";

describe("shared entity validation", () => {
  it("rejects an assignment whose deadline precedes its start", () => {
    expect(() =>
      validateAssignmentInput({
        courseCode: "CS",
        courseName: "Course",
        title: "Lab",
        deadline: "2026-01-01",
        startDate: "2026-01-02"
      })
    ).toThrow("highlighted");
  });
  it("requires useful project and note text", () => {
    expect(() => validateProjectInput({ title: "   " })).toThrow("highlighted");
    expect(() => validateNoteInput({ title: "Note", body: " " })).toThrow(
      "highlighted"
    );
  });
});
