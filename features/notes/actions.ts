"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/lib/domain/dates";
import { mutationSuccess, type MutationResult } from "@/lib/mutations";
import { requireOwnerAction } from "@/lib/auth/web-session";
import {
  createNote,
  deleteNote,
  type NoteInput,
  updateNote
} from "@/features/notes/service";
export type NoteFormState = {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string>;
  resultId?: string;
};
const v = (f: FormData, n: string) => String(f.get(n) ?? "");
const values = (f: FormData) =>
  ({
    title: v(f, "title"),
    body: v(f, "body"),
    linkedTaskId: v(f, "linkedTaskId") || null,
    linkedAssignmentId: v(f, "linkedAssignmentId") || null,
    projectId: v(f, "projectId") || null,
    tagIds: f.getAll("tagIds").map(String)
  }) as NoteInput;

const fail = (e: unknown): NoteFormState =>
  e instanceof ValidationError
    ? { message: e.message, fields: e.fields }
    : { message: "Could not save this note. Please try again." };
export async function createNoteAction(
  _: NoteFormState,
  f: FormData
): Promise<NoteFormState> {
  await requireOwnerAction();
  try {
    await createNote(values(f));
    revalidatePath("/notes");
    return mutationSuccess("Note created.");
  } catch (e) {
    return fail(e);
  }
}
export async function updateNoteAction(
  _: NoteFormState,
  f: FormData
): Promise<NoteFormState> {
  await requireOwnerAction();
  try {
    if (!(await updateNote(v(f, "id"), values(f))))
      return { message: "This note no longer exists." };
    revalidatePath("/notes");
    return mutationSuccess("Note saved.");
  } catch (e) {
    return fail(e);
  }
}
export async function deleteNoteAction(f: FormData): Promise<MutationResult> {
  await requireOwnerAction();
  try {
    if (!(await deleteNote(v(f, "id"))))
      return { ok: false, message: "This note no longer exists." };
    revalidatePath("/notes");
    return mutationSuccess();
  } catch {
    return {
      ok: false,
      message: "Could not delete this note. Please try again."
    };
  }
}
