import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  timelineItems,
  type TimelineFilters
} from "@/features/timeline/service";
import { addMonths, todayDateOnly } from "@/lib/domain/dates";
import { formatDate, priorityClass, statusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const monthKey = (date: Date) => date.toISOString().slice(0, 7);
function href(params: TimelineFilters, update: Partial<TimelineFilters>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...update }))
    if (value) q.set(key, value);
  return `/timeline?${q}`;
}
export default async function TimelinePage({
  searchParams
}: {
  searchParams: Promise<TimelineFilters>;
}) {
  const params = await searchParams;
  const result = await timelineItems(params);
  const range = params.range ?? "this_month";
  const today = todayDateOnly();
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {range === "all"
              ? "All dated planning items"
              : `${formatDate(result.start)} to ${formatDate(result.end)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link
              href={href(params, {
                month: monthKey(addMonths(result.month, -1))
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
              href={href(params, {
                month: monthKey(addMonths(result.month, 1))
              })}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
      <form className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-4">
        <input type="hidden" name="month" value={monthKey(result.month)} />
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
        <Select name="range" defaultValue={range}>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
          <option value="all">All dates</option>
        </Select>
        <Button variant="secondary">Apply</Button>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>
            {result.items.length} planning{" "}
            {result.items.length === 1 ? "item" : "items"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {["Assignments", "Tasks", "Projects"].map((group) => (
            <section key={group}>
              <h2 className="mb-2 text-sm font-semibold">{group}</h2>
              <div className="space-y-2">
                {result.items
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <Link
                      key={`${item.entity}-${item.id}`}
                      href={item.href}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted"
                    >
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.startDate
                            ? `${formatDate(item.startDate)} → `
                            : ""}
                          {formatDate(item.date)} · {item.event}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Badge>{statusLabel(item.status)}</Badge>
                        <Badge className={priorityClass(item.priority)}>
                          {item.priority}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                {!result.items.some((item) => item.group === group) && (
                  <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                    No {group.toLowerCase()} in this view.
                  </p>
                )}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
