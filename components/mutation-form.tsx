"use client";

import { useActionState, type ReactNode } from "react";
import type { MutationResult } from "@/lib/mutations";

export function MutationForm({
  action,
  className,
  children
}: {
  action: (formData: FormData) => Promise<MutationResult>;
  className?: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useActionState(
    async (_previous: MutationResult, formData: FormData) => action(formData),
    {} as MutationResult
  );

  return (
    <form action={dispatch} className={className}>
      {children}
      {state.ok === false && (
        <p role="status" className="text-xs text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
