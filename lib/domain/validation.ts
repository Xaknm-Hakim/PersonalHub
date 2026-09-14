import { z } from "zod";
import { ValidationError } from "@/lib/domain/dates";

export const id = z
  .string()
  .trim()
  .min(1, "Required")
  .max(191, "Too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid identifier");
export const tagIds = z
  .array(id)
  .refine((ids) => new Set(ids).size === ids.length, "Tag IDs must be unique");
export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url("Use a valid URL.")
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "URL must use http or https.");

export function validationError(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues)
    fields[String(issue.path[0] ?? "body")] ??= issue.message;
  return new ValidationError(fields);
}

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error);
  return result.data;
}
