"use client";
import Link from "next/link";
import { useActionState } from "react";
import {
  createAssignmentAction,
  type AssignmentFormState,
  updateAssignmentAction
} from "@/features/assignments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignmentStatuses,
  assignmentTypes,
  priorities
} from "@/lib/constants";
import { dateInputValue, statusLabel } from "@/lib/utils";
type Assignment = {
  id: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  startDate: Date | null;
  deadline: Date;
  tags?: Tag[];
} | null;
type Tag = { id: string; name: string };
export function AssignmentForm({
  assignment,
  tags
}: {
  assignment: Assignment;
  tags: Tag[];
}) {
  const [state, action, pending] = useActionState(
    assignment ? updateAssignmentAction : createAssignmentAction,
    {} as AssignmentFormState
  );

  const err = (n: string) =>
    state.fields?.[n] && (
      <p className="mt-1 text-xs text-destructive">{state.fields[n]}</p>
    );
  return (
    <form action={action} className="space-y-3">
      {assignment && <input type="hidden" name="id" value={assignment.id} />}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Course code
          <Input
            className="mt-1"
            name="courseCode"
            required
            defaultValue={assignment?.courseCode}
          />
          {err("courseCode")}
        </label>
        <label className="text-sm">
          Course name
          <Input
            className="mt-1"
            name="courseName"
            required
            defaultValue={assignment?.courseName}
          />
          {err("courseName")}
        </label>
      </div>
      <label className="text-sm">
        Title
        <Input
          className="mt-1"
          name="title"
          required
          defaultValue={assignment?.title}
        />
        {err("title")}
      </label>
      <details open={!!assignment} className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Additional details
        </summary>
        <div className="mt-3 space-y-3">
          <Textarea
            name="description"
            placeholder="Description"
            defaultValue={assignment?.description ?? ""}
          />
          <div className="grid grid-cols-3 gap-2">
            <Select name="type" defaultValue={assignment?.type ?? "assignment"}>
              {assignmentTypes.map((x) => (
                <option key={x} value={x}>
                  {statusLabel(x)}
                </option>
              ))}
            </Select>
            <Select
              name="status"
              defaultValue={assignment?.status ?? "not_started"}
            >
              {assignmentStatuses.map((x) => (
                <option key={x} value={x}>
                  {statusLabel(x)}
                </option>
              ))}
            </Select>
            <Select
              name="priority"
              defaultValue={assignment?.priority ?? "medium"}
            >
              {priorities.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Start
              <Input
                className="mt-1"
                type="date"
                name="startDate"
                defaultValue={dateInputValue(assignment?.startDate)}
              />
            </label>
            <label className="text-sm">
              Deadline
              <Input
                className="mt-1"
                type="date"
                name="deadline"
                required
                defaultValue={dateInputValue(assignment?.deadline)}
              />
              {err("deadline")}
            </label>
          </div>
          <fieldset>
            <legend className="text-sm">Tags</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {tags.map((t) => (
                <label className="text-sm" key={t.id}>
                  <input
                    className="mr-1"
                    type="checkbox"
                    name="tagIds"
                    value={t.id}
                    defaultChecked={assignment?.tags?.some?.(
                      (x: Tag) => x.id === t.id
                    )}
                  />
                  {t.name}
                </label>
              ))}
            </div>
            {err("tagIds")}
          </fieldset>
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
          {pending
            ? "Saving…"
            : assignment
              ? "Save assignment"
              : "Create assignment"}
        </Button>
        {assignment && (
          <Button asChild variant="outline">
            <Link href="/assignments">Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
