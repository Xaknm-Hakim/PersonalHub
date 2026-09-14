"use client";
import { useActionState, useEffect, useRef } from "react";
import { quickCaptureTaskAction, type FormState } from "@/app/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Shared task capture form. It clears only after the capture service accepts the task. */
export function QuickCapture() {
  const [state, action, pending] = useActionState(
    quickCaptureTaskAction,
    {} as FormState
  );
  const form = useRef<HTMLFormElement>(null);
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.resultId && state.resultId !== handled.current) {
      form.current?.reset();
      handled.current = state.resultId;
    }
  }, [state.ok, state.resultId]);
  return (
    <form
      ref={form}
      action={action}
      className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_auto_auto]"
      aria-label="Quick task capture"
    >
      <div>
        <label className="sr-only" htmlFor="quick-title">
          Task title
        </label>
        <Input
          id="quick-title"
          name="title"
          required
          placeholder="Capture a task…"
          aria-describedby={
            state.fields?.title ? "quick-title-error" : undefined
          }
        />
        {state.fields?.title && (
          <p id="quick-title-error" className="mt-1 text-xs text-destructive">
            {state.fields.title}
          </p>
        )}
      </div>
      <label className="text-sm sm:w-36">
        <span className="sr-only">Due date</span>
        <Input name="dueDate" type="date" aria-label="Optional due date" />
      </label>
      <Button disabled={pending}>{pending ? "Adding…" : "Add task"}</Button>
      {state.message && (
        <p
          className={
            state.ok
              ? "text-xs text-green-700 sm:col-span-3"
              : "text-xs text-destructive sm:col-span-3"
          }
          role="status"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
export default QuickCapture;
