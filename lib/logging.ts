type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, boolean | number | string | null | undefined>;

export function logEvent(
  level: LogLevel,
  event: string,
  fields: LogFields = {}
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    )
  });
  const output = level === "error" ? console.error : console.log;
  output(entry);
}
