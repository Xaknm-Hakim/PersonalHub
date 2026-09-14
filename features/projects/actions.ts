"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/lib/domain/dates";
import { mutationSuccess, type MutationResult } from "@/lib/mutations";
import {
  createProject,
  deleteProject,
  type ProjectInput,
  updateProject
} from "@/features/projects/service";
export type ProjectFormState = {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string>;
  resultId?: string;
};
const v = (f: FormData, n: string) => String(f.get(n) ?? "");
const values = (f: FormData) =>
  ({
    title: v(f, "title"),
    description: v(f, "description") || null,
    status: v(f, "status") || "planned",
    type: v(f, "type") || "other",
    priority: v(f, "priority") || "medium",
    startDate: v(f, "startDate"),
    targetDate: v(f, "targetDate"),
    completedAt: v(f, "completedAt"),
    repositoryUrl: v(f, "repositoryUrl") || null,
    localPath: v(f, "localPath") || null,
    liveUrl: v(f, "liveUrl") || null,
    techStack: v(f, "techStack") || null,
    objective: v(f, "objective") || null,
    currentProgress: v(f, "currentProgress") || null,
    nextAction: v(f, "nextAction") || null,
    lessonsLearned: v(f, "lessonsLearned") || null
  }) as ProjectInput;

const fail = (e: unknown): ProjectFormState =>
  e instanceof ValidationError
    ? { message: e.message, fields: e.fields }
    : { message: "Could not save this project. Please try again." };
export async function createProjectAction(
  _: ProjectFormState,
  f: FormData
): Promise<ProjectFormState> {
  try {
    await createProject(values(f));
    revalidatePath("/projects");
    return mutationSuccess("Project created.");
  } catch (e) {
    return fail(e);
  }
}
export async function updateProjectAction(
  _: ProjectFormState,
  f: FormData
): Promise<ProjectFormState> {
  try {
    if (!(await updateProject(v(f, "id"), values(f))))
      return { message: "This project no longer exists." };
    revalidatePath("/projects");
    return mutationSuccess("Project saved.");
  } catch (e) {
    return fail(e);
  }
}
export async function deleteProjectAction(
  f: FormData
): Promise<MutationResult> {
  try {
    if (!(await deleteProject(v(f, "id"))))
      return { ok: false, message: "This project no longer exists." };
    revalidatePath("/projects");
    return mutationSuccess();
  } catch {
    return {
      ok: false,
      message: "Could not delete this project. Please try again."
    };
  }
}
