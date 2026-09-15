import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { calendarItems } from "@/features/calendar/service";
import {
  addDays,
  addMonths,
  dateOnly,
  todayDateOnly
} from "@/lib/domain/dates";
import { parsePlanningMonth } from "@/features/planning/semantics";

export const dynamic = "force-dynamic";
type Params = { month?: string; type?: string; status?: string };
const monthKey = (date: Date) => date.toISOString().slice(0, 7);
function href(params: Params, update: Partial<Params>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...update }))
    if (value) search.set(key, value);
  return `/calendar?${search}`;
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const today = todayDateOnly();
  const monthStart =
    parsePlanningMonth(params.month) ??
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const gridStart = addDays(monthStart, -monthStart.getUTCDay());
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const gridEnd = gridDays.at(-1)!;
  const events = await calendarItems(gridStart, gridEnd, params);
  const label = new Intl.DateTimeFormat("en-MY", {
    timeZone: "UTC",
    month: "long",
    year: "numeric"
  }).format(monthStart);
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link
              href={href(params, {
                month: monthKey(addMonths(monthStart, -1))
              })}
            >
              Previous
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={href(params, { month: monthKey(today) })}>Today</Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              href={href(params, { month: monthKey(addMonths(monthStart, 1)) })}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
      <form className="mb-4 flex flex-wrap gap-2 rounded-lg border bg-card p-3">
        <input type="hidden" name="month" value={monthKey(monthStart)} />
        <Select name="type" defaultValue={params.type ?? ""}>
          <option value="">All types</option>
          <option value="task">Tasks</option>
          <option value="assignment">Assignments</option>
          <option value="project">Projects</option>
        </Select>
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">All statuses</option>
          <option value="todo">Todo</option>
          <option value="doing">Doing</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </Select>
        <Button variant="secondary">Apply</Button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[760px] grid-cols-7 bg-card text-sm">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="border-b bg-muted/40 p-3 font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {gridDays.map((day) => {
            const key = dateOnly(day)!;
            const entries = events.filter((event) => event.date === key);
            const inMonth = day.getUTCMonth() === monthStart.getUTCMonth();
            const isToday = key === dateOnly(today);
            return (
              <div
                key={key}
                className={`min-h-32 border-b border-r p-2 ${isToday ? "bg-amber-50 dark:bg-amber-950/50" : inMonth ? "bg-card" : "bg-muted/20"}`}
              >
                <p
                  className={inMonth ? "font-medium" : "text-muted-foreground"}
                >
                  {day.getUTCDate()}
                </p>
                <div className="mt-2 space-y-1">
                  {entries.map((entry) => (
                    <Link
                      key={`${entry.entity}-${entry.id}`}
                      href={entry.href}
                      className={`block rounded border px-2 py-1 text-xs ${entry.overdue ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200"}`}
                    >
                      <Badge className="mr-1 bg-background/80">
                        {entry.event === "target" ? "Target" : entry.entity}
                      </Badge>
                      {entry.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
