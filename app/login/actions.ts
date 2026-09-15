"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginOwner } from "@/lib/auth/owner";
import {
  clearCurrentSession,
  loginThrottleKey,
  requireOwnerAction,
  setSessionCookie
} from "@/lib/auth/web-session";
import { logEvent } from "@/lib/logging";
import { assertSameOrigin } from "@/lib/security/origin";

export type LoginState = { message?: string };

export async function loginAction(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  assertSameOrigin(
    await headers(),
    process.env.PERSONALHUB_TRUST_PROXY === "true"
  );
  const password = String(formData.get("password") ?? "");
  if (!password) return { message: "Enter the owner password." };
  const result = await loginOwner(password, await loginThrottleKey());
  if (!result.ok)
    return {
      message:
        result.reason === "RATE_LIMITED"
          ? "Too many attempts. Wait five minutes and try again."
          : "The password is incorrect."
    };
  await setSessionCookie(result.token, result.expiresAt);
  redirect("/");
}

export async function logoutAction() {
  await requireOwnerAction();
  await clearCurrentSession();
  logEvent("info", "logout_succeeded");
  redirect("/login");
}
