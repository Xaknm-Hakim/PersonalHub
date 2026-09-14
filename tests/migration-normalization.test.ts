import { describe, expect, it } from "vitest";
import {
  normalizeDateOnly,
  normalizeMigrationRow,
  normalizeTimestamp,
  validateMigrationSource
} from "../scripts/migrate-sqlite-to-postgres";

describe("SQLite migration normalization", () => {
  it("uses the planning timezone for epoch and ISO-offset planning timestamps", () => {
    expect(normalizeDateOnly(0, "Assignment.deadline")).toBe("1970-01-01");
    expect(normalizeDateOnly(-86_400_000, "Assignment.deadline")).toBe(
      "1969-12-31"
    );
    expect(
      normalizeDateOnly("2026-01-01T00:30:00+14:00", "Assignment.deadline")
    ).toBe("2025-12-31");
    expect(
      normalizeDateOnly(
        "2026-01-01T00:30:00Z",
        "Assignment.deadline",
        "America/Los_Angeles"
      )
    ).toBe("2025-12-31");
  });

  it("treats zone-less SQLite timestamps as UTC instants", () => {
    expect(
      normalizeTimestamp("2026-01-01 00:00:00", "Task.createdAt")?.toISOString()
    ).toBe("2026-01-01T00:00:00.000Z");
    expect(
      normalizeTimestamp(1_767_123_456_789, "Task.updatedAt")?.getTime()
    ).toBe(1_767_123_456_789);
  });

  it("rejects impossible calendar dates instead of allowing Date rollover", () => {
    expect(() => normalizeDateOnly("2026-02-29", "Task.dueDate")).toThrow(
      "Invalid Task.dueDate"
    );
    expect(() => normalizeDateOnly("2026-13-01", "Task.dueDate")).toThrow(
      "Invalid Task.dueDate"
    );
  });

  it("normalizes Assignment.deadline as a PostgreSQL date", () => {
    const row = normalizeMigrationRow(
      {
        id: "assignment-1",
        courseCode: "CS1",
        courseName: "Course",
        title: "Title",
        description: null,
        type: "assignment",
        status: "not_started",
        priority: "medium",
        startDate: null,
        deadline: 1_768_003_200_000,
        completedAt: null,
        createdAt: 1_767_123_456_789,
        updatedAt: 1_767_123_456_789
      },
      "Assignment"
    );
    expect(row.deadline).toBe("2026-01-10");
  });

  it("rejects unknown priority values rather than looking up an undefined column", () => {
    const source = {
      Tag: [],
      Project: [],
      Task: [],
      Note: [],
      _TaskTags: [],
      _AssignmentTags: [],
      _NoteTags: [],
      Assignment: [
        {
          id: "assignment-1",
          courseCode: "CS1",
          courseName: "Course",
          title: "Title",
          description: null,
          type: "assignment",
          status: "not_started",
          priority: "mystery",
          startDate: null,
          deadline: "2026-01-10",
          completedAt: null,
          createdAt: 0,
          updatedAt: 0
        }
      ]
    };
    expect(() => validateMigrationSource(source)).toThrow(
      "Unknown legacy Assignment.priority: mystery"
    );
  });
});
