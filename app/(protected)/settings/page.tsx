import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listApiTokens } from "@/lib/auth/api-tokens";
import { ApiTokenForm } from "./api-token-form";
import { revokeApiTokenAction } from "./actions";

export const dynamic = "force-dynamic";

const formatTimestamp = (value: Date | null) =>
  value
    ? value
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, " UTC")
    : "Never";

export default async function SettingsPage() {
  const tokens = await listApiTokens();
  return (
    <>
      <PageHeader title="Settings / About" description="PersonalHub 0.1.0" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create API token</CardTitle>
          </CardHeader>
          <CardContent>
            <ApiTokenForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>API tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tokens.length ? (
              tokens.map((token) => (
                <div key={token.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{token.name}</p>
                      <p className="text-muted-foreground">
                        {token.scopes.join(", ")} · created{" "}
                        {formatTimestamp(token.createdAt)}
                      </p>
                      <p className="text-muted-foreground">
                        Last used: {formatTimestamp(token.lastUsedAt)} ·
                        expires: {formatTimestamp(token.expiresAt)}
                      </p>
                      {token.revokedAt ? (
                        <p className="text-destructive">
                          Revoked {formatTimestamp(token.revokedAt)}
                        </p>
                      ) : null}
                    </div>
                    {!token.revokedAt ? (
                      <form action={revokeApiTokenAction}>
                        <input type="hidden" name="id" value={token.id} />
                        <Button size="sm" variant="destructive">
                          Revoke
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No API tokens.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Single-owner service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            PersonalHub uses an owner password for browser sessions and separate
            revocable bearer tokens for trusted API clients. It has no
            registration, sharing, teams, or account recovery service.
          </p>
          <p>
            App version:{" "}
            <span className="font-mono text-foreground">0.1.0</span>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
