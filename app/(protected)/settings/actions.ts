"use server";

import { revalidatePath } from "next/cache";
import {
  apiScopes,
  createApiToken,
  revokeApiToken,
  type ApiScope
} from "@/lib/auth/api-tokens";
import { requireOwnerAction } from "@/lib/auth/web-session";

export type TokenFormState = {
  message?: string;
  plaintext?: string;
  resultId?: string;
};

export async function createApiTokenAction(
  _previous: TokenFormState,
  form: FormData
): Promise<TokenFormState> {
  await requireOwnerAction();
  const scopes = form
    .getAll("scopes")
    .map(String)
    .filter((scope): scope is ApiScope =>
      apiScopes.includes(scope as ApiScope)
    );
  const expiryDays = String(form.get("expiryDays") ?? "");
  const allowedExpiryDays = ["", "30", "90", "365"];
  if (!allowedExpiryDays.includes(expiryDays))
    return { message: "Choose a valid expiration period." };
  try {
    const expiresAt = expiryDays
      ? new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000)
      : null;
    const issued = await createApiToken({
      name: String(form.get("name") ?? ""),
      scopes,
      expiresAt
    });
    revalidatePath("/settings");
    return {
      plaintext: issued.plaintext,
      message: "Copy this token now. It will not be shown again.",
      resultId: issued.token.id
    };
  } catch {
    return {
      message: "Could not create the token. Check its name and scopes."
    };
  }
}

export async function revokeApiTokenAction(form: FormData) {
  await requireOwnerAction();
  await revokeApiToken(String(form.get("id") ?? ""));
  revalidatePath("/settings");
}
