import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { formatDate, isBeforeToday, priorityClass, statusLabel } from "@/lib/utils";

const dayMs = 86_400_000;

export default async function TimelinePage({
  searchParams
}: {
  searchParams: Promise<{ type?: string; status?: string; range?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + (params.range === "this_month" ? 31 : 7));
  const range = params.range ?? "this_month";

  const [tasks, assignments] = await Promise.all([
    params.type === "assignments" ? [] : prisma.task.findMany({ orderBy: { dueDate: "asc" } }),
    params.type === "tasks" ? [] : prisma.assignment.findMany({ orderBy: { deadline: "asc" } })
  ]);

  const items = [
    ...assignments.map((item) => ({
      id: item.id,
      group: "Assignments",
      type: "assignment",
      title: item.title,
      status: item.status,
      priority: item.priority,
      start: item.startDate ?? item.createdAt,
      end: item.deadline,
      href: `/assignments?edit=${item.id}`
    })),
    ...tasks.filter((task) => task.dueDate).map((item) => ({
      id: item.id,
      group: "Tasks",
      type: "task",
      title: item.title,
      status: item.status,
      priority: item.priority,
      start: item.startDate ?? item.createdAt,
      end: item.dueDate ?? item.createdAt,
      href: `/tasks?edit=${item.id}`
    }))
  ].filter((item) => {
    const statusMatch = params.status ? item.status === params.status : true;
    const rangeMatch = range === "all" ? true : item.end >= start && item.start <= end;
    return statusMatch && rangeMatch;
  });

  const minDate = range === "all" && items.length ? new Date(Math.min(...items.map((i) => i.start.getTime()))) : start;
  const maxDate = range === "all" && items.length ? new Date(Math.max(...items.map((i) => i.end.getTime()))) : end;
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / dayMs) + 1);
  const ticks = Array.from({ length: Math.min(totalDays, 14) }, (_, index) => {
    const tick = new Date(minDate);
    tick.setDate(minDate.getDate() + Math.floor((index * totalDays) / Math.min(totalDays, 14)));
    return tick;
  });

  return (
    <>
      <PageHeader title="Timeline" description="A lightweight Gantt-style view for tasks and assignment planning." />
      <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-4">
        <Select name="type" defaultValue={params.type ?? ""}>
          <option value="">All types</option>
          <option value="assignments">Assignments</option>
          <option value="tasks">Tasks</option>
        </Select>
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="todo">Todo</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
          <option value="submitted">Submitted</option>
        </Select>
        <Select name="range" defaultValue={range}>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
          <option value="all">All</option>
        </Select>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>
      <Card>
        <CardContent className="overflow-x-auto p-4">
          <div className="min-w-[900px]">
            <div className="mb-3 grid grid-cols-[220px_1fr] gap-4 text-xs text-muted-foreground">
              <div>Item</div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(60px, 1fr))` }}>
                {ticks.map((tick) => <span key={tick.toISOString()}>{formatDate(tick)}</span>)}
              </div>
            </div>
            {["Assignments", "Tasks"].map((group) => (
              <div key={group} className="mb-5">
                <h2 className="mb-2 text-sm font-semibold">{group}</h2>
                <div className="space-y-2">
                  {items.filter((item) => item.group === group).map((item) => {
                    const left = Math.max(0, ((item.start.getTime() - minDate.getTime()) / dayMs / totalDays) * 100);
                    const width = Math.max(4, (((item.end.getTime() - item.start.getTime()) / dayMs + 1) / totalDays) * 100);
                    const overdue = !["done", "submitted", "graded", "cancelled"].includes(item.status) && isBeforeToday(item.end);
                    return (
                      <div key={`${item.type}-${item.id}`} className="grid grid-cols-[220px_1fr] items-center gap-4">
                        <div>
                          <Link href={item.href} className="text-sm font-medium hover:underline">{item.title}</Link>
                          <div className="mt-1 flex gap-1">
                            <Badge>{item.type}</Badge>
                            <Badge className={priorityClass(item.priority)}>{item.priority}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{statusLabel(item.status)} · {formatDate(item.start)} to {formatDate(item.end)}</p>
                        </div>
                        <div className="relative h-9 rounded-md border bg-muted/70">
                          <Link
                            href={item.href}
                            className={
                              overdue
                                ? "absolute top-1 h-7 overflow-hidden rounded-md bg-red-500 px-2 text-xs font-medium leading-7 text-white hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600"
                                : "absolute top-1 h-7 overflow-hidden rounded-md bg-teal-600 px-2 text-xs font-medium leading-7 text-white hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                            }
                            style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                          >
                            <span className="block truncate">{overdue ? "Overdue" : item.title}</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No timeline items match these filters.</p> : null}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
