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
  return new Date(date).toISOString().slice(0, 10);
}

export function parseOptionalDate(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === "") return null;
  return new Date(`${String(value)}T00:00:00`);
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
