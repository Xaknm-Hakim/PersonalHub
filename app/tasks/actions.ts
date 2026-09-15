"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/lib/domain/dates";
import { mutationSuccess, type MutationResult } from "@/lib/mutations";
import { requireOwnerAction } from "@/lib/auth/web-session";
import {
  captureTask,
  completeTask,
  createTask,
  deleteTask,
  updateTask
} from "@/features/tasks/service";
export type FormState = {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string>;
  resultId?: string;
  values?: Record<string, string | string[]>;
};
const value = (form: FormData, name: string) => String(form.get(name) ?? "");
const taskValues = (form: FormData) =>
  ({
    title: value(form, "title"),
    description: value(form, "description"),
    status: value(form, "status") || "todo",
    priority: value(form, "priority") || "medium",
    startDate: value(form, "startDate"),
    dueDate: value(form, "dueDate"),
    projectId: value(form, "projectId") || null,
    tagIds: form.getAll("tagIds").map(String)
  }) as Parameters<typeof createTask>[0];

function failure(error: unknown, form: FormData): FormState {
  const values = Object.fromEntries(
    [...new Set(form.keys())].map((name) => {
      const all = form.getAll(name).map(String);
      return [name, all.length > 1 ? all : (all[0] ?? "")];
    })
  );
  return error instanceof ValidationError
    ? { fields: error.fields, message: error.message, values }
    : { message: "Could not save this task. Please try again.", values };
}
export async function quickCaptureTaskAction(
  _previous: FormState,
  form: FormData
): Promise<FormState> {
  await requireOwnerAction();
  try {
    const task = await captureTask({
      title: value(form, "title"),
      dueDate: value(form, "dueDate")
    });
    return { ok: true, message: "Task added.", resultId: task.id };
  } catch (error) {
    return failure(error, form);
  }
}
export async function createTaskAction(
  _previous: FormState,
  form: FormData
): Promise<FormState> {
  await requireOwnerAction();
  try {
    await createTask(taskValues(form));
    revalidatePath("/tasks");
    return mutationSuccess("Task created.");
  } catch (error) {
    return failure(error, form);
  }
}
export async function updateTaskAction(
  _previous: FormState,
  form: FormData
): Promise<FormState> {
  await requireOwnerAction();
  try {
    if (!(await updateTask(value(form, "id"), taskValues(form))))
      return { message: "This task no longer exists." };
    revalidatePath("/tasks");
    return mutationSuccess("Task saved.");
  } catch (error) {
    return failure(error, form);
  }
}
export async function completeTaskAction(
  form: FormData
): Promise<MutationResult> {
  await requireOwnerAction();
  try {
    if (!(await completeTask(value(form, "id"))))
      return { ok: false, message: "This task no longer exists." };
    revalidatePath("/tasks");
    return mutationSuccess();
  } catch {
    return {
      ok: false,
      message: "Could not complete this task. Please try again."
    };
  }
}
export async function deleteTaskAction(
  form: FormData
): Promise<MutationResult> {
  await requireOwnerAction();
  try {
    if (!(await deleteTask(value(form, "id"))))
      return { ok: false, message: "This task no longer exists." };
    revalidatePath("/tasks");
    return mutationSuccess();
  } catch {
    return {
      ok: false,
      message: "Could not delete this task. Please try again."
    };
  }
}
