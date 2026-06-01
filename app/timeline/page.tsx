import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { formatDate, isBeforeToday, priorityClass, statusLabel } from "@/lib/utils";

const dayMs = 86_400_000;

type TimelineParams = {
  month?: string;
  type?: string;
  status?: string;
  range?: string;
};

function monthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function selectedMonthFromParam(month?: string) {
  const today = new Date();
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return new Date(year, monthNumber - 1, 1);
}

function getTimelineRange(range: string, selectedMonth: Date) {
  if (range === "this_week") {
    const today = new Date();
    const selectedMonthIsCurrent =
      selectedMonth.getFullYear() === today.getFullYear() && selectedMonth.getMonth() === today.getMonth();
    const anchor = selectedMonthIsCurrent ? today : selectedMonth;
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "this_month") {
    const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  return { start: selectedMonth, end: selectedMonth };
}

function timelineHref(params: TimelineParams, updates: TimelineParams) {
  const search = new URLSearchParams();
  const merged = { ...params, ...updates };
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/timeline?${query}` : "/timeline";
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / dayMs));
}

function tickDates(start: Date, totalDays: number) {
  const maxTicks = totalDays <= 10 ? totalDays + 1 : totalDays <= 45 ? 8 : 10;
  return Array.from({ length: maxTicks }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + Math.round((index * totalDays) / Math.max(1, maxTicks - 1)));
    return date;
  });
}

export default async function TimelinePage({
  searchParams
}: {
  searchParams: Promise<TimelineParams>;
}) {
  const params = await searchParams;
  const selectedMonth = selectedMonthFromParam(params.month);
  const selectedMonthLabel = selectedMonth.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
  const currentMonth = new Date();
  const previousMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
  const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
  const range = params.range ?? "this_month";
  const baseRange = getTimelineRange(range, selectedMonth);

  const [tasks, assignments] = await Promise.all([
    params.type === "assignments" ? [] : prisma.task.findMany({ orderBy: { dueDate: "asc" } }),
    params.type === "tasks" ? [] : prisma.assignment.findMany({ orderBy: { deadline: "asc" } })
  ]);

  const allItems = [
    ...assignments.map((item) => ({
      id: item.id,
      group: "Assignments",
      type: "assignment",
      category: item.type,
      title: item.title,
      status: item.status,
      priority: item.priority,
      start: item.startDate ?? item.createdAt,
      end: item.deadline,
      href: `/assignments?edit=${item.id}`
    })),
    ...tasks
      .filter((task) => task.dueDate)
      .map((item) => ({
        id: item.id,
        group: "Tasks",
        type: "task",
        category: "task",
        title: item.title,
        status: item.status,
        priority: item.priority,
        start: item.startDate ?? item.createdAt,
        end: item.dueDate ?? item.createdAt,
        href: `/tasks?edit=${item.id}`
      }))
  ].filter((item) => (params.status ? item.status === params.status : true));

  const minItemDate = allItems.length ? new Date(Math.min(...allItems.map((item) => item.start.getTime()))) : baseRange.start;
  const maxItemDate = allItems.length ? new Date(Math.max(...allItems.map((item) => item.end.getTime()))) : baseRange.end;
  const visibleStart = range === "all" ? minItemDate : baseRange.start;
  const visibleEnd = range === "all" ? maxItemDate : baseRange.end;
  visibleStart.setHours(0, 0, 0, 0);
  visibleEnd.setHours(23, 59, 59, 999);

  const items = allItems.filter((item) => (range === "all" ? true : item.end >= visibleStart && item.start <= visibleEnd));
  const totalDays = Math.max(1, Math.ceil((visibleEnd.getTime() - visibleStart.getTime()) / dayMs));
  const ticks = tickDates(visibleStart, totalDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayInRange = today >= visibleStart && today <= visibleEnd;
  const todayLeft = todayInRange ? (daysBetween(visibleStart, today) / totalDays) * 100 : 0;
  const filterSummary = [
    params.type === "tasks" ? "Tasks" : params.type === "assignments" ? "Assignments" : "Tasks + Assignments",
    params.status ? statusLabel(params.status) : "All statuses",
    range === "all" ? "All dates" : range === "this_week" ? "This week" : "This month"
  ].join(" · ");
  const periodLabel =
    range === "all"
      ? `${formatDate(visibleStart)} to ${formatDate(visibleEnd)}`
      : range === "this_week"
        ? `Week of ${formatDate(visibleStart)}`
        : selectedMonthLabel;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={timelineHref(params, { month: monthParam(previousMonth) })}>Previous Month</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={timelineHref(params, { month: monthParam(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)) })}>
              Today
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={timelineHref(params, { month: monthParam(nextMonth) })}>Next Month</Link>
          </Button>
        </div>
      </div>

      <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-4">
        <input type="hidden" name="month" value={monthParam(selectedMonth)} />
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
        <CardHeader className="border-b">
          <CardTitle>{selectedMonthLabel} · {items.length} {items.length === 1 ? "item" : "items"} · {filterSummary}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visible range: {formatDate(visibleStart)} to {formatDate(visibleEnd)}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
              <p className="font-medium">No timeline items for this period.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a task with a due date or an assignment with a deadline to see it here.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild variant="secondary"><Link href="/tasks">Create Task</Link></Button>
                <Button asChild><Link href="/assignments">Create Assignment</Link></Button>
              </div>
            </div>
          ) : (
            <div className="min-w-[980px]">
              <div className="mb-3 grid grid-cols-[280px_1fr] gap-5 text-xs text-muted-foreground">
                <div>Item</div>
                <div className="relative grid" style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(72px, 1fr))` }}>
                  {ticks.map((tick) => (
                    <span key={tick.toISOString()}>{formatDate(tick)}</span>
                  ))}
                </div>
              </div>
              {["Assignments", "Tasks"].map((group) => {
                const groupItems = items.filter((item) => item.group === group);
                return (
                  <section key={group} className="mb-7 last:mb-0">
                    <h2 className="mb-3 text-sm font-semibold">{group}</h2>
                    {groupItems.length === 0 ? (
                      <p className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">No {group.toLowerCase()} in this view.</p>
                    ) : (
                      <div className="space-y-4">
                        {groupItems.map((item) => {
                          const clampedStart = item.start < visibleStart ? visibleStart : item.start;
                          const clampedEnd = item.end > visibleEnd ? visibleEnd : item.end;
                          const startsBefore = item.start < visibleStart;
                          const continuesAfter = item.end > visibleEnd;
                          const left = Math.max(0, (daysBetween(visibleStart, clampedStart) / totalDays) * 100);
                          const width = Math.max(3, ((daysBetween(clampedStart, clampedEnd) + 1) / totalDays) * 100);
                          const overdue = !["done", "submitted", "graded", "cancelled"].includes(item.status) && isBeforeToday(item.end);
                          return (
                            <div key={`${item.type}-${item.id}`} className="grid grid-cols-[280px_1fr] items-center gap-5 rounded-md border bg-card p-3">
                              <div>
                                <Link href={item.href} className="text-sm font-medium hover:underline">{item.title}</Link>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Badge>{statusLabel(item.category)}</Badge>
                                  <Badge>{statusLabel(item.status)}</Badge>
                                  <Badge className={priorityClass(item.priority)}>{item.priority}</Badge>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.start)} to {formatDate(item.end)}</p>
                              </div>
                              <div
                                className="relative h-14 rounded-md border bg-muted/60"
                                style={{
                                  backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)`,
                                  backgroundSize: `${100 / totalDays}% 100%`
                                }}
                              >
                                {todayInRange ? (
                                  <div className="absolute top-0 h-full w-px bg-amber-500" style={{ left: `${todayLeft}%` }}>
                                    <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                      Today
                                    </span>
                                  </div>
                                ) : null}
                                <Link
                                  href={item.href}
                                  className={
                                    overdue
                                      ? "absolute top-3 flex h-8 items-center overflow-hidden rounded-md bg-red-500 px-2 text-xs font-medium text-white shadow-sm hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600"
                                      : "absolute top-3 flex h-8 items-center overflow-hidden rounded-md bg-teal-600 px-2 text-xs font-medium text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                                  }
                                  style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                                >
                                  {startsBefore ? <ChevronLeft className="mr-1 h-3 w-3 shrink-0" /> : null}
                                  <span className="truncate">{startsBefore ? "Started before" : item.title}</span>
                                  {continuesAfter ? (
                                    <span className="ml-auto flex shrink-0 items-center pl-2 opacity-90">
                                      continues <ChevronRight className="ml-0.5 h-3 w-3" />
                                    </span>
                                  ) : null}
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
