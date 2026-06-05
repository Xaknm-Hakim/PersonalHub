import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date?: Date | string | null) {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}

export function dateInputValue(date?: Date | string | null) {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseOptionalDate(value: FormDataEntryValue | null) {
  const text = value ? String(value).trim() : "";
  if (!text) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new Error(`Invalid date value: ${text}`);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function isBeforeToday(date?: Date | null) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value < today;
}

export function priorityClass(priority: string) {
  const map: Record<string, string> = {
    low: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    medium: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    high: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    urgent: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
  };
  return map[priority] ?? map.medium;
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}
