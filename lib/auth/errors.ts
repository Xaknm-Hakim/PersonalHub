export type AuthErrorCode = "UNAUTHORIZED" | "INSUFFICIENT_SCOPE";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
