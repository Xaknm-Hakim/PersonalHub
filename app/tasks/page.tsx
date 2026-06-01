import Link from "next/link";
import { createTask, deleteTask, updateTask } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { priorities, taskStatuses } from "@/lib/constants";
import { dateInputValue, formatDate, isBeforeToday, priorityClass, statusLabel } from "@/lib/utils";

export default async function TasksPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; priority?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {})
  };
  const [tasks, editing] = await Promise.all([
    prisma.task.findMany({ where, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] }),
    params.edit ? prisma.task.findUnique({ where: { id: params.edit } }) : null
  ]);

  return (
    <>
      <PageHeader title="Tasks" description="Track personal work, study errands, and practical deadlines." />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <TaskForm mode={editing ? "Edit task" : "Create task"} task={editing} />
        <section>
          <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_1fr_auto]">
            <Select name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
            <Select name="priority" defaultValue={params.priority ?? ""}>
              <option value="">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
          {tasks.length === 0 ? (
            <EmptyState title="No tasks found" message="Create a task or clear your filters." />
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const overdue = task.status !== "done" && task.status !== "cancelled" && isBeforeToday(task.dueDate);
                return (
                  <Card key={task.id} className={overdue ? "border-red-300 dark:border-red-800" : ""}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link href={`/tasks?edit=${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                          <p className="mt-1 text-sm text-muted-foreground">{task.description || "No description"}</p>
                          <p className={overdue ? "mt-2 text-sm font-medium text-red-600 dark:text-red-300" : "mt-2 text-sm text-muted-foreground"}>
                            Start {formatDate(task.startDate)} · Due {formatDate(task.dueDate)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{statusLabel(task.status)}</Badge>
                          <Badge className={priorityClass(task.priority)}>{task.priority}</Badge>
                          {overdue ? <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">Overdue</Badge> : null}
                        </div>
                      </div>
                      <form action={deleteTask} className="mt-3">
                        <input type="hidden" name="id" value={task.id} />
                        <Button type="submit" variant="destructive" size="sm">Delete</Button>
                      </form>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function TaskForm({ mode, task }: { mode: string; task: Awaited<ReturnType<typeof prisma.task.findUnique>> }) {
  const action = task ? updateTask : createTask;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          {task ? <input type="hidden" name="id" value={task.id} /> : null}
          <Input name="title" placeholder="Task title" defaultValue={task?.title ?? ""} required />
          <Textarea name="description" placeholder="Description" defaultValue={task?.description ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Select name="status" defaultValue={task?.status ?? "todo"}>
              {taskStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </Select>
            <Select name="priority" defaultValue={task?.priority ?? "medium"}>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              Start date
              <Input className="mt-1" type="date" name="startDate" defaultValue={dateInputValue(task?.startDate)} />
            </label>
            <label className="text-sm font-medium">
              Due date
              <Input className="mt-1" type="date" name="dueDate" defaultValue={dateInputValue(task?.dueDate)} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">{task ? "Save task" : "Create task"}</Button>
            {task ? <Button asChild variant="outline"><Link href="/tasks">Cancel</Link></Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
