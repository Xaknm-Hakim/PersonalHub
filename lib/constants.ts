export const taskStatuses = ["todo", "doing", "done", "cancelled"] as const;
export const assignmentStatuses = ["not_started", "in_progress", "submitted", "graded", "cancelled"] as const;
export const assignmentTypes = ["assignment", "exercise", "lab", "quiz", "project", "revision", "other"] as const;
export const priorities = ["low", "medium", "high", "urgent"] as const;

export type TaskStatusValue = (typeof taskStatuses)[number];
export type AssignmentStatusValue = (typeof assignmentStatuses)[number];
export type AssignmentTypeValue = (typeof assignmentTypes)[number];
export type PriorityValue = (typeof priorities)[number];
