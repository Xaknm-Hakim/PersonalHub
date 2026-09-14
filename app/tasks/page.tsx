import Link from "next/link";
import { notFound } from "next/navigation";
import { completeTaskAction, deleteTaskAction } from "@/app/tasks/actions";
import { QuickCapture } from "@/components/quick-capture";
import { DeleteControl } from "@/components/delete-control";
import { TaskForm } from "@/components/forms/task-form";
import { MutationForm } from "@/components/mutation-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { findTasks, taskById } from "@/features/tasks/service";
import { findProjects } from "@/features/projects/service";
import { findTags } from "@/features/tags/service";
import { priorities, taskStatuses } from "@/lib/constants";
import { isClosed } from "@/lib/domain/status";
import {
  formatDate,
  isBeforeToday,
  priorityClass,
  statusLabel
} from "@/lib/utils";
export default async function TasksPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    q?: string;
    tagId?: string;
    edit?: string;
  }>;
}) {
  const p = await searchParams;
  const [tasks, editing, projects, tags] = await Promise.all([
    findTasks(p),
    p.edit ? taskById(p.edit) : null,
    findProjects(),
    findTags()
  ]);
  if (p.edit && !editing) notFound();
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Capture work quickly, then add detail only when it helps."
      />
      <div className="mb-6">
        <QuickCapture />
      </div>
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit task" : "Task details"}</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm
              key={editing?.id ?? "new-task"}
              task={editing}
              projects={projects}
              tags={tags}
            />
          </CardContent>
        </Card>
        <section>
          <form className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              name="q"
              placeholder="Search tasks"
              defaultValue={p.q ?? ""}
            />
            <Select name="status" defaultValue={p.status ?? ""}>
              <option value="">All statuses</option>
              {taskStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
            <Select name="priority" defaultValue={p.priority ?? ""}>
              <option value="">All priorities</option>
              {priorities.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
            <Select name="tagId" defaultValue={p.tagId ?? ""}>
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary">Filter</Button>
          </form>
          {!tasks.length ? (
            <EmptyState
              title="No tasks found"
              message="Capture a task or clear the filters."
            />
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => {
                const overdue =
                  !isClosed("task", t.status) && isBeforeToday(t.dueDate);
                return (
                  <Card
                    key={t.id}
                    className={
                      overdue ? "border-red-300 dark:border-red-800" : ""
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <Link
                            href={`/tasks?edit=${t.id}`}
                            className="font-medium hover:underline"
                          >
                            {t.title}
                          </Link>
                          {t.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t.description}
                            </p>
                          )}
                          <p className="mt-1 text-sm text-muted-foreground">
                            Due {formatDate(t.dueDate)}
                            {t.project ? ` · ${t.project.title}` : ""}
                          </p>
                          {t.tags.length ? (
                            <div className="mt-2 flex gap-1">
                              {t.tags.map((x) => (
                                <Badge key={x.id}>{x.name}</Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Badge>{statusLabel(t.status)}</Badge>
                          <Badge className={priorityClass(t.priority)}>
                            {t.priority}
                          </Badge>
                          {overdue && (
                            <Badge className="text-red-700">Overdue</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {t.status !== "done" && (
                          <MutationForm action={completeTaskAction}>
                            <input type="hidden" name="id" value={t.id} />
                            <Button size="sm" variant="secondary">
                              Complete
                            </Button>
                          </MutationForm>
                        )}
                        <DeleteControl action={deleteTaskAction} id={t.id} />
                      </div>
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
