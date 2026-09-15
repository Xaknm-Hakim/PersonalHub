import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { revokeSession, validateSessionToken } from "@/lib/auth/owner";
import { assertSameOrigin } from "@/lib/security/origin";

export const sessionCookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-personalhub_session"
    : "personalhub_session";

const trustProxy = () => process.env.PERSONALHUB_TRUST_PROXY === "true";

export async function optionalOwnerSession() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  return token ? validateSessionToken(token) : null;
}

export async function requireOwnerSession() {
  const session = await optionalOwnerSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireOwnerAction() {
  assertSameOrigin(await headers(), trustProxy());
  const session = await optionalOwnerSession();
  if (!session)
    throw new AuthError("UNAUTHORIZED", 401, "Authentication is required.");
  return session;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt
  });
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) await revokeSession(token);
  cookieStore.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0)
  });
}

export async function loginThrottleKey() {
  const requestHeaders = await headers();
  const forwarded = trustProxy()
    ? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    : null;
  const source = forwarded && forwarded.length <= 64 ? forwarded : "direct";
  return createHash("sha256").update(source).digest("hex");
}
