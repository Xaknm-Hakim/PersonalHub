import { randomUUID } from "node:crypto";

export type MutationResult =
  | { ok: true; resultId: string; message?: string }
  | { ok: false; message: string; resultId?: never };

export function mutationSuccess(message?: string): MutationResult {
  return { ok: true, resultId: randomUUID(), ...(message ? { message } : {}) };
}
