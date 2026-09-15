import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@/lib/security/headers";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const trustProxy = process.env.PERSONALHUB_TRUST_PROXY === "true";
  const forwardedHttps =
    trustProxy && request.headers.get("x-forwarded-proto") === "https";
  const secureProduction =
    process.env.NODE_ENV === "production" &&
    (request.nextUrl.protocol === "https:" || forwardedHttps);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(
    securityHeaders(nonce, secureProduction)
  ))
    response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
