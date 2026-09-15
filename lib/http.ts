import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/domain/dates";
import { verifyApiBearer, type ApiScope } from "@/lib/auth/api-tokens";
import { AuthError } from "@/lib/auth/errors";
import { logEvent } from "@/lib/logging";

const maximumJsonBytes = 64 * 1024;

export async function requireApi(request: Request, scope: ApiScope) {
  try {
    return await verifyApiBearer(request.headers.get("authorization"), scope);
  } catch (error) {
    logEvent("warn", "api_authentication_failed", {
      reason: error instanceof AuthError ? error.code : "UNKNOWN"
    });
    throw error;
  }
}

export async function jsonBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/i.test(
      contentType
    )
  )
    throw new AccessError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json."
    );
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumJsonBytes)
    throw new AccessError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body is too large."
    );
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumJsonBytes)
    throw new AccessError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body is too large."
    );
  if (!body.trim())
    throw new AccessError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON."
    );
  return JSON.parse(body) as unknown;
}

export function assertValidId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,191}$/.test(id))
    throw new AccessError(422, "VALIDATION_ERROR", "ID is invalid.");
}
export class AccessError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AccessError";
  }
}
export const ok = (data: unknown, status = 200) =>
  NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } }
  );
export function apiError(error: unknown) {
  if (error instanceof AuthError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: {
          "Cache-Control": "no-store",
          ...(error.status === 401
            ? { "WWW-Authenticate": 'Bearer realm="PersonalHub"' }
            : {})
        }
      }
    );
  if (error instanceof AccessError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  if (error instanceof Response) return error;
  if (error instanceof ValidationError)
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
          fields: error.fields
        }
      },
      { status: 422 }
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON."
        }
      },
      { status: 400 }
    );
  logEvent("error", "api_internal_error", {
    errorType: error instanceof Error ? error.name : typeof error
  });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
    { status: 500 }
  );
}
