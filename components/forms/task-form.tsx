"use client";
import Link from "next/link";
import { useActionState } from "react";
import {
  createTaskAction,
  type FormState,
  updateTaskAction
} from "@/app/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { priorities, taskStatuses } from "@/lib/constants";
import { dateInputValue, statusLabel } from "@/lib/utils";
type Item = { id: string; title: string };
type Tag = { id: string; name: string };
type Task = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  tags: Tag[];
  status: string;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
} | null;
export function TaskForm({
  task,
  projects,
  tags
}: {
  task: Task;
  projects: Item[];
  tags: Tag[];
}) {
  const [state, action, pending] = useActionState(
    task ? updateTaskAction : createTaskAction,
    {} as FormState
  );

  const error = (name: string) => (
    <>
      {state.fields?.[name] && (
        <p className="mt-1 text-xs text-destructive">{state.fields[name]}</p>
      )}
    </>
  );
  const saved = (name: string, fallback = "") => {
    const value = state.values?.[name];
    return typeof value === "string" ? value : fallback;
  };
  const savedTags = Array.isArray(state.values?.tagIds)
    ? state.values.tagIds
    : typeof state.values?.tagIds === "string"
      ? [state.values.tagIds]
      : undefined;
  return (
    <form action={action} className="space-y-3">
      {task && <input type="hidden" name="id" value={task.id} />}
      <label className="block text-sm font-medium">
        Title
        <Input
          className="mt-1"
          name="title"
          required
          defaultValue={saved("title", task?.title ?? "")}
        />
        {error("title")}
      </label>
      <details open={!!task} className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced details
        </summary>
        <div className="mt-3 space-y-3">
          <Textarea
            name="description"
            aria-label="Description"
            placeholder="Description"
            defaultValue={saved("description", task?.description ?? "")}
          />
          <Select
            name="projectId"
            aria-label="Project"
            defaultValue={saved("projectId", task?.projectId ?? "")}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <fieldset>
            <legend className="text-sm font-medium">Tags</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {tags.map((t) => (
                <label key={t.id} className="text-sm">
                  <input
                    className="mr-1"
                    type="checkbox"
                    name="tagIds"
                    value={t.id}
                    defaultChecked={
                      savedTags
                        ? savedTags.includes(t.id)
                        : task?.tags.some((x) => x.id === t.id)
                    }
                  />
                  {t.name}
                </label>
              ))}
            </div>
            {error("tagIds")}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Select
              name="status"
              aria-label="Status"
              defaultValue={saved("status", task?.status ?? "todo")}
            >
              {taskStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
            <Select
              name="priority"
              aria-label="Priority"
              defaultValue={saved("priority", task?.priority ?? "medium")}
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Start date
              <Input
                className="mt-1"
                type="date"
                name="startDate"
                defaultValue={saved(
                  "startDate",
                  dateInputValue(task?.startDate)
                )}
              />
            </label>
            <label className="text-sm">
              Due date
              <Input
                className="mt-1"
                type="date"
                name="dueDate"
                defaultValue={saved("dueDate", dateInputValue(task?.dueDate))}
              />
              {error("dueDate")}
            </label>
          </div>
        </div>
      </details>
      {state.message && (
        <p
          role="status"
          className={
            state.ok ? "text-sm text-green-700" : "text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={pending}>
          {pending ? "Saving…" : task ? "Save task" : "Create task"}
        </Button>
        {task && (
          <Button asChild variant="outline">
            <Link href="/tasks">Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
