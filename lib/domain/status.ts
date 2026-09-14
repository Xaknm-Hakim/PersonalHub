export const taskStatuses = ["todo", "doing", "done", "cancelled"] as const;
export const assignmentStatuses = [
  "not_started",
  "in_progress",
  "submitted",
  "graded",
  "completed",
  "cancelled"
] as const;
export const assignmentTypes = [
  "assignment",
  "exercise",
  "lab",
  "quiz",
  "project",
  "revision",
  "other"
] as const;
export const projectStatuses = [
  "planned",
  "developing",
  "active",
  "paused",
  "completed",
  "archived",
  "abandoned"
] as const;
export const projectTypes = [
  "software",
  "infrastructure",
  "networking",
  "cloud",
  "academic",
  "event_ops",
  "lab",
  "documentation",
  "other"
] as const;
export const priorities = ["low", "medium", "high", "urgent"] as const;

export const closedTaskStatuses = new Set<string>(["done", "cancelled"]);
// `completed` is accepted because legacy databases may contain it; it is closed without rewriting history.
export const closedAssignmentStatuses = new Set<string>([
  "submitted",
  "graded",
  "completed",
  "cancelled"
]);
export const closedProjectStatuses = new Set<string>([
  "completed",
  "archived",
  "abandoned"
]);
export const isTaskClosed = (status: string) => closedTaskStatuses.has(status);
export const isAssignmentClosed = (status: string) =>
  closedAssignmentStatuses.has(status);
export const isProjectClosed = (status: string) =>
  closedProjectStatuses.has(status);
export const isClosed = (
  entity: "task" | "assignment" | "project",
  status: string
) =>
  entity === "task"
    ? isTaskClosed(status)
    : entity === "assignment"
      ? isAssignmentClosed(status)
      : isProjectClosed(status);
