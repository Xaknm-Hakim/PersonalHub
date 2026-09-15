"use server";
import { revalidatePath } from "next/cache";
import { createTag, deleteTag, updateTag } from "@/features/tags/service";
import { mutationSuccess, type MutationResult } from "@/lib/mutations";
import { requireOwnerAction } from "@/lib/auth/web-session";
export async function createTagAction(form: FormData): Promise<MutationResult> {
  await requireOwnerAction();
  try {
    await createTag({
      name: String(form.get("name") ?? ""),
      color: String(form.get("color") ?? "")
    });
    revalidatePath("/tags");
    return mutationSuccess();
  } catch {
    return {
      ok: false,
      message: "Could not create this tag. Please check its name and color."
    };
  }
}
export async function deleteTagAction(form: FormData): Promise<MutationResult> {
  await requireOwnerAction();
  if (!(await deleteTag(String(form.get("id") ?? ""))))
    return { ok: false, message: "This tag no longer exists." };
  revalidatePath("/tags");
  return mutationSuccess();
}
export async function updateTagAction(form: FormData): Promise<MutationResult> {
  await requireOwnerAction();
  try {
    if (
      !(await updateTag(String(form.get("id") ?? ""), {
        name: String(form.get("name") ?? ""),
        color: String(form.get("color") ?? "")
      }))
    )
      return { ok: false, message: "This tag no longer exists." };
    revalidatePath("/tags");
    return mutationSuccess();
  } catch {
    return {
      ok: false,
      message: "Could not save this tag. Please check its name and color."
    };
  }
}
