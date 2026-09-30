import {
  googleOAuthFailureStages,
  googleOAuthTokenExchangeReasons,
  type GoogleOAuthFailureStage,
  type GoogleOAuthTokenExchangeReason
} from "./callback-observability";

export const googleOAuthCompletionResults = [
  "connected",
  "callback_error",
  "state_error",
  "authorization_denied"
] as const;

export type GoogleOAuthCompletionResult =
  (typeof googleOAuthCompletionResults)[number];

type CompletionInput = Record<string, unknown>;

function boundedValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : undefined;
}

export function googleOAuthCompletionTarget(input: CompletionInput) {
  const google =
    boundedValue(input.google, googleOAuthCompletionResults) ??
    "callback_error";
  const target = new URL("https://personalhub.invalid/settings");
  target.searchParams.set("google", google);
  if (google !== "callback_error") return `${target.pathname}${target.search}`;

  const stage = boundedValue<GoogleOAuthFailureStage>(
    input.stage,
    googleOAuthFailureStages
  );
  if (stage) target.searchParams.set("stage", stage);

  if (stage === "token_exchange") {
    const reason = boundedValue<GoogleOAuthTokenExchangeReason>(
      input.reason,
      googleOAuthTokenExchangeReasons
    );
    if (reason) target.searchParams.set("reason", reason);
  }
  return `${target.pathname}${target.search}`;
}

export function googleOAuthCompletionBounceTarget(input: CompletionInput) {
  const settingsTarget = googleOAuthCompletionTarget(input);
  return `/oauth/google/complete/bounce#${settingsTarget.split("?")[1]}`;
}
