import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/domain/dates";

/** Single local access boundary; replace with an owner/session check when auth is introduced. */
export function assertLocalAccess(request: Request) {
  const host = request.headers.get("host") ?? "";
  // Host is only a local deployment boundary, not authentication. Browser writes must
  // additionally be same-origin to avoid a local-service CSRF primitive.
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
    throw new AccessError(404, "NOT_FOUND", "Not found.");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      let originUrl: URL;
      try {
        originUrl = new URL(origin);
      } catch {
        throw new AccessError(
          403,
          "ACCESS_DENIED",
          "Mutation origin is not allowed."
        );
      }
      if (
        originUrl.host.toLowerCase() !== host.toLowerCase() ||
        !/^https?:$/.test(originUrl.protocol)
      )
        throw new AccessError(
          403,
          "ACCESS_DENIED",
          "Mutation origin is not allowed."
        );
    }
  }
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
  NextResponse.json({ data }, { status });
export function apiError(error: unknown) {
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
  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
    { status: 500 }
  );
}
