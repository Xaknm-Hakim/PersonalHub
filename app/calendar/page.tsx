import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { isBeforeToday } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
  const [tasks, assignments] = await Promise.all([
    prisma.task.findMany({ where: { dueDate: { gte: gridStart, lte: monthEnd } } }),
    prisma.assignment.findMany({ where: { deadline: { gte: gridStart, lte: monthEnd } } })
  ]);
  const events = [
    ...tasks.map((task) => ({ date: task.dueDate, title: task.title, href: `/tasks?edit=${task.id}`, kind: "Task", overdue: task.status !== "done" && task.status !== "cancelled" && isBeforeToday(task.dueDate) })),
    ...assignments.map((assignment) => ({ date: assignment.deadline, title: assignment.title, href: `/assignments?edit=${assignment.id}`, kind: assignment.courseCode, overdue: !["submitted", "graded", "cancelled"].includes(assignment.status) && isBeforeToday(assignment.deadline) }))
  ];

  return (
    <>
      <PageHeader title="Calendar" description={today.toLocaleDateString("en-MY", { month: "long", year: "numeric" })} />
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border bg-card text-sm">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="border-b bg-muted/40 p-3 font-medium text-muted-foreground">{day}</div>
        ))}
        {gridDays.map((day) => {
          const dayEvents = events.filter((event) => event.date && event.date.toDateString() === day.toDateString());
          const isToday = day.toDateString() === today.toDateString();
          const inMonth = day.getMonth() === today.getMonth();
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
                        ? "block rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/70"
                        : "block rounded-md border border-teal-100 bg-teal-50 px-2 py-1 text-xs text-teal-800 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-900/70"
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
