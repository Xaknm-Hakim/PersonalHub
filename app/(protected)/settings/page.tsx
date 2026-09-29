import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listApiTokens } from "@/lib/auth/api-tokens";
import { ApiTokenForm } from "./api-token-form";
import { revokeApiTokenAction } from "./actions";
import { googleIntegrationStatus } from "@/services/integrations/google/service";
import { googleIntegrationIsConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

const formatTimestamp = (value: Date | null) =>
  value
    ? value
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, " UTC")
    : "Never";

const googleMessages: Record<string, string> = {
  connected: "Google Calendar connected.",
  synced: "Google Calendar projection synchronized.",
  disconnected:
    "Google Calendar disconnected. Existing Google calendar data was preserved.",
  state_error:
    "Google authorization state was invalid or expired. Please try again.",
  authorization_denied: "Google authorization was not granted.",
  callback_error: "Google authorization could not be completed.",
  sync_error:
    "Google Calendar synchronization did not complete. It is safe to retry."
};

const googleCallbackFailureMessages: Record<string, string> = {
  transaction_validation:
    "Google connection failed during OAuth transaction validation.",
  session_validation:
    "Google connection failed because the initiating owner session is no longer valid.",
  authorization_code:
    "Google connection failed because the authorization response was incomplete.",
  token_exchange: "Google connection failed during token exchange.",
  refresh_token:
    "Google connection failed because no refresh authorization was returned.",
  scope_validation:
    "Google connection failed because the granted scopes did not match.",
  credential_encryption:
    "Google connection failed while protecting the refresh authorization.",
  persistence: "Google connection failed while saving the connection.",
  callback_processing: "Google connection failed while processing the callback."
};

function googleMessage(params: { google?: string; stage?: string }) {
  if (params.google === "callback_error" && params.stage)
    return (
      googleCallbackFailureMessages[params.stage] ??
      googleMessages.callback_error
    );
  return params.google ? googleMessages[params.google] : undefined;
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ google?: string; stage?: string }>;
}) {
  const [tokens, google, params] = await Promise.all([
    listApiTokens(),
    googleIntegrationStatus(),
    searchParams
  ]);
  const googleConnected = google?.status === "connected";
  const googleConfigured = googleIntegrationIsConfigured();
  const statusMessage = googleMessage(params);
  return (
    <>
      <PageHeader title="Settings / About" description="PersonalHub 0.1.0" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Google Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {statusMessage ? (
              <p className="rounded-md border p-3">{statusMessage}</p>
            ) : null}
            {googleConnected ? (
              <>
                <div className="space-y-1 text-muted-foreground">
                  <p>
                    Status: <span className="text-foreground">Connected</span>
                  </p>
                  <p>Calendar: PersonalHub</p>
                  <p>
                    Last successful sync:{" "}
                    {formatTimestamp(google.lastSuccessfulSyncAt)}
                  </p>
                  {google.lastSyncErrorCode ? (
                    <p className="text-destructive">
                      Last sync needs attention: {google.lastSyncErrorCode}
                    </p>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  PersonalHub is authoritative. Sync Now projects open dated
                  tasks and assignments one way; Google-side edits may be
                  overwritten.
                </p>
                <div className="flex gap-2">
                  <form method="post" action="/api/v1/integrations/google/sync">
                    <Button type="submit">Sync Now</Button>
                  </form>
                  <form
                    method="post"
                    action="/api/v1/integrations/google/disconnect"
                  >
                    <Button type="submit" variant="outline">
                      Disconnect
                    </Button>
                  </form>
                </div>
              </>
            ) : googleConfigured ? (
              <>
                <p className="text-muted-foreground">
                  Not connected. PersonalHub requests access only to calendars
                  it creates for this projection.
                </p>
                <Button asChild>
                  <a href="/api/v1/integrations/google/connect">
                    Connect Google
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">
                Google Calendar is not configured for this environment.
              </p>
            )}
          </CardContent>
        </Card>
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
