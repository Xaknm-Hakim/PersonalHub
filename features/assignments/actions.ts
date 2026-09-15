"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/lib/domain/dates";
import { mutationSuccess, type MutationResult } from "@/lib/mutations";
import { requireOwnerAction } from "@/lib/auth/web-session";
import {
  createAssignment,
  deleteAssignment,
  type AssignmentInput,
  updateAssignment
} from "@/features/assignments/service";

export type AssignmentFormState = {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string>;
  resultId?: string;
};
const value = (form: FormData, name: string) => String(form.get(name) ?? "");
const values = (form: FormData) =>
  ({
    courseCode: value(form, "courseCode"),
    courseName: value(form, "courseName"),
    title: value(form, "title"),
    description: value(form, "description") || null,
    type: value(form, "type") || "assignment",
    status: value(form, "status") || "not_started",
    priority: value(form, "priority") || "medium",
    startDate: value(form, "startDate"),
    deadline: value(form, "deadline"),
    tagIds: form.getAll("tagIds").map(String)
  }) as AssignmentInput;

const fail = (error: unknown): AssignmentFormState =>
  error instanceof ValidationError
    ? { message: error.message, fields: error.fields }
    : { message: "Could not save this assignment. Please try again." };
export async function createAssignmentAction(
  _: AssignmentFormState,
  form: FormData
): Promise<AssignmentFormState> {
  await requireOwnerAction();
  try {
    await createAssignment(values(form));
    revalidatePath("/assignments");
    return mutationSuccess("Assignment created.");
  } catch (error) {
    return fail(error);
  }
}
export async function updateAssignmentAction(
  _: AssignmentFormState,
  form: FormData
): Promise<AssignmentFormState> {
  await requireOwnerAction();
  try {
    if (!(await updateAssignment(value(form, "id"), values(form))))
      return { message: "This assignment no longer exists." };
    revalidatePath("/assignments");
    return mutationSuccess("Assignment saved.");
  } catch (error) {
    return fail(error);
  }
}
export async function deleteAssignmentAction(
  form: FormData
): Promise<MutationResult> {
  await requireOwnerAction();
  try {
    if (!(await deleteAssignment(value(form, "id"))))
      return { ok: false, message: "This assignment no longer exists." };
    revalidatePath("/assignments");
    return mutationSuccess();
  } catch {
    return {
      ok: false,
      message: "Could not delete this assignment. Please try again."
    };
  }
}
