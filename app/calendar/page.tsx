import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { isBeforeToday, statusLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

function monthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function selectedMonthFromParam(month?: string) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return new Date(year, monthNumber - 1, 1);
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const monthStart = selectedMonthFromParam(params.month);
  const selectedMonthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const gridEnd = new Date(gridDays[gridDays.length - 1]);
  gridEnd.setHours(23, 59, 59, 999);
  const previousMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const selectedMonthLabel = monthStart.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
  const [tasks, assignments] = await Promise.all([
    prisma.task.findMany({ where: { dueDate: { gte: gridStart, lte: gridEnd } } }),
    prisma.assignment.findMany({ where: { deadline: { gte: gridStart, lte: gridEnd } } })
  ]);
  const events = [
    ...tasks.map((task) => ({ date: task.dueDate, title: task.title, href: `/tasks?edit=${task.id}`, kind: "Task", overdue: task.status !== "done" && task.status !== "cancelled" && isBeforeToday(task.dueDate) })),
    ...assignments.map((assignment) => ({ date: assignment.deadline, title: assignment.title, href: `/assignments?edit=${assignment.id}`, kind: statusLabel(assignment.type), overdue: !["submitted", "graded", "cancelled"].includes(assignment.status) && isBeforeToday(assignment.deadline) }))
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">{selectedMonthLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/calendar?month=${monthParam(previousMonth)}`}>Previous Month</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/calendar?month=${monthParam(new Date(today.getFullYear(), today.getMonth(), 1))}`}>Today</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/calendar?month=${monthParam(nextMonth)}`}>Next Month</Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border bg-card text-sm">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="border-b bg-muted/40 p-3 font-medium text-muted-foreground">{day}</div>
        ))}
        {gridDays.map((day) => {
          const dayEvents = events.filter((event) => event.date && event.date.toDateString() === day.toDateString());
          const isToday = day.toDateString() === today.toDateString();
          const inMonth = day >= monthStart && day <= selectedMonthEnd;
          return (
            <div
              key={day.toISOString()}
              className={
                isToday
                  ? "min-h-32 border-b border-r bg-amber-50 p-2 dark:bg-amber-950/50"
                  : inMonth
                    ? "min-h-32 border-b border-r bg-card p-2"
                    : "min-h-32 border-b border-r bg-muted/20 p-2"
              }
            >
              <div className={inMonth ? "font-medium" : "text-muted-foreground"}>{day.getDate()}</div>
              <div className="mt-2 space-y-1">
                {dayEvents.map((event) => (
                  <Link
                    key={`${event.kind}-${event.title}`}
                    href={event.href}
                    className={
                      event.overdue
                        ? inMonth
                          ? "block rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/70"
                          : "block rounded-md border border-red-100 bg-red-50/60 px-2 py-1 text-xs text-red-700/70 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200/70 dark:hover:bg-red-900/60"
                        : inMonth
                          ? "block rounded-md border border-teal-100 bg-teal-50 px-2 py-1 text-xs text-teal-800 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-900/70"
                          : "block rounded-md border border-teal-100 bg-teal-50/60 px-2 py-1 text-xs text-teal-800/70 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200/70 dark:hover:bg-teal-900/60"
                    }
                  >
                    <Badge className="mr-1 bg-background/80">{event.kind}</Badge>
                    {event.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
