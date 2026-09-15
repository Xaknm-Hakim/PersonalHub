"use client";

import { useActionState } from "react";
import {
  createApiTokenAction,
  type TokenFormState
} from "@/app/(protected)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function ApiTokenForm() {
  const [state, action, pending] = useActionState<TokenFormState, FormData>(
    createApiTokenAction,
    {}
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="token-name" className="mb-1 block text-sm font-medium">
          Token name
        </label>
        <Input id="token-name" name="name" maxLength={100} required />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Access</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="scopes" value="read" defaultChecked />{" "}
            Read
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="scopes" value="write" /> Write
          </label>
        </div>
      </fieldset>
      <div>
        <label
          htmlFor="token-expiry"
          className="mb-1 block text-sm font-medium"
        >
          Expiration
        </label>
        <Select id="token-expiry" name="expiryDays" defaultValue="90">
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
          <option value="">No expiration</option>
        </Select>
      </div>
      <Button disabled={pending}>
        {pending ? "Creating…" : "Create token"}
      </Button>
      {state.message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : null}
      {state.plaintext ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-2 text-sm font-medium">New API token (shown once)</p>
          <code className="block break-all text-xs" data-testid="new-api-token">
            {state.plaintext}
          </code>
        </div>
      ) : null}
    </form>
  );
}
