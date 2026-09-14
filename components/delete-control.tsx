"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { MutationResult } from "@/lib/mutations";

/** A deliberately two-step destructive action; it cannot submit on its first click. */
function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? "Deleting…" : "Confirm delete"}
    </Button>
  );
}
export function DeleteControl({
  action,
  id,
  label = "Delete"
}: {
  action: (formData: FormData) => Promise<MutationResult>;
  id: string;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, dispatch] = useActionState(
    async (_previous: MutationResult, formData: FormData) => action(formData),
    {} as MutationResult
  );
  return (
    <form action={dispatch} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {confirming ? (
        <>
          <span className="text-xs text-destructive">Delete permanently?</span>
          <ConfirmButton />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          {label}
        </Button>
      )}
      {state.ok === false && (
        <span role="status" className="text-xs text-destructive">
          {state.message}
        </span>
      )}
    </form>
  );
}
