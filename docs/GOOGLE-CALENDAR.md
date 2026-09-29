# Google Calendar projection (v3.2)

## Boundary

PersonalHub remains authoritative. v3.2 manually projects open, dated PersonalHub tasks and assignments into a dedicated secondary Google calendar named `PersonalHub`:

```text
PersonalHub -> Google Calendar -> calendar clients such as Samsung Calendar
```

It is not an import or bidirectional synchronization feature. Changes made directly to managed Google events are not imported and may be overwritten by the next **Sync Now**. There is no scheduler, queue, webhook, worker, or background daemon in v3.2.

## Google authorization

The integration uses Google's OAuth 2.0 web-server flow. Google describes this flow as appropriate for applications that can keep confidential information and maintain state, and it supports access after the user leaves the application through offline refresh authorization:

- <https://developers.google.com/identity/protocols/oauth2/web-server>
- <https://developers.google.com/identity/protocols/oauth2>

The requested scopes are:

```text
https://www.googleapis.com/auth/calendar.app.created
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

Google defines `calendar.app.created` as permission to create secondary calendars and to see, create, change, and delete events on those app-created calendars. `calendar.calendarlist.readonly` permits metadata-only calendar-list discovery, which closes the failure window where Google creates the managed calendar but PersonalHub exits before persisting its ID. Neither scope permits event access on arbitrary user calendars. This pair is narrower than `calendar`, `calendar.events`, or `calendar.events.owned` and is sufficient for the dedicated-calendar design:

- <https://developers.google.com/workspace/calendar/api/auth>
- <https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert>
- <https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list>

The authorization request uses:

- an exact HTTPS callback URI;
- a random CSRF `state` value;
- PKCE S256 as defense in depth;
- `access_type=offline` to request refresh authorization;
- `prompt=consent` so a deliberate reconnect can obtain a refresh token;
- a ten-minute, signed, `Secure`, `HttpOnly`, `SameSite=Lax` transaction cookie;
- an authenticated owner browser session at initiation;
- the exact initiating session ID inside the signed transaction.

The ordinary owner cookie remains `SameSite=Strict` and is not expected on Google's cross-site redirect. The callback instead requires the signed transaction and verifies that its bound session still exists, is unexpired, and still matches the owner's authentication version. It never falls back to another current session, mere owner existence, or API bearer authentication. The transaction cookie is single-use and cleared before callback processing. Its signing key is purpose-separated from the integration encryption key using HKDF-SHA-256. API bearer tokens cannot initiate, complete, synchronize, or disconnect this browser-owned integration.

Google's current security guidance requires secure storage for client credentials and user tokens and recommends encrypted-at-rest refresh tokens for server applications:

- <https://developers.google.com/identity/protocols/oauth2/resources/best-practices>

## Credential storage

PersonalHub does not persist Google access tokens. It obtains a short-lived access token from Google when **Sync Now** is invoked.

The durable refresh credential is encrypted before PostgreSQL persistence with:

- AES-256-GCM authenticated encryption;
- a random 96-bit nonce for every encryption;
- a separate authentication tag;
- envelope version `v1`;
- associated data binding the ciphertext to the integration ID, provider, credential purpose, and version;
- a dedicated 256-bit `PERSONALHUB_INTEGRATION_ENCRYPTION_KEY`.

The key is not stored in PostgreSQL, source control, Terraform state, plans, or command arguments. Production materialization is:

```text
SSM Parameter Store SecureString
  -> exact EC2 host-role GetParameter permission
  -> root-owned /etc/personalhub/runtime.env (0600)
  -> app container environment
```

The PostgreSQL password, Cloudflare token, owner password, and API-token material are not reused. Actual Google credentials and encryption keys must never be pasted into chat, committed, or printed.

## Durable model

`Integration` stores the one Google connection, encrypted refresh credential, connection status, dedicated calendar ID, compact last-sync state, and a renewable ten-minute sync lease.

`ExternalResource` stores the durable association:

```text
(provider, local entity type, local entity ID) <-> Google event ID
```

There is no speculative provider registry, sync-run ledger, event bus, or job model.

## Projection eligibility

The projection uses existing domain closure semantics rather than inventing Google-specific status rules:

- task: `dueDate` exists and task status is not `done` or `cancelled`;
- assignment: `deadline` exists and assignment status is not `submitted`, `graded`, `completed`, or `cancelled`.

Assignments always have a date in the current domain model. Undated tasks, projects, notes, tags, credentials, and security records are not projected.

## Event representation

Each item is an all-day event because PersonalHub planning dates are date-only values:

- summary: `Task: <title>` or `Assignment: <title>`;
- start: source date;
- end: the next date, because Google all-day event end dates are exclusive;
- description: a short warning that PersonalHub manages the projection;
- private extended properties: PersonalHub entity type, entity ID, and projection version.

Google documents all-day `start.date` / `end.date` and private extended properties in the Events resource:

- <https://developers.google.com/workspace/calendar/api/v3/reference/events>

No PersonalHub API token, internal credential, or sensitive system state is written to event fields.

## Reconciliation and idempotency

A manual sync:

1. refreshes a short-lived Google access token;
2. validates the recorded calendar, rediscovers its exact management marker, or creates one dedicated `PersonalHub` calendar;
3. loads eligible tasks and assignments and their mappings;
4. inserts missing events;
5. updates existing managed events to PersonalHub's authoritative representation;
6. deletes managed events whose mapped source is deleted or no longer eligible;
7. records successful mappings only after the Google operation succeeds;
8. updates `lastSuccessfulSyncAt` only if every operation succeeds.

Event IDs are deterministic hashes of local type and ID using Google's allowed event-ID alphabet. This closes the external-success/database-failure gap: retrying an insert converges through conflict/update rather than creating a duplicate. Title matching is never used. Unmapped Google events are never modified or deleted.

Calendar resources do not offer event-style private extended properties. PersonalHub therefore places a stable, non-secret `personalhub-integration:<integration-id>` marker in the app-created calendar's description. Calendar-list discovery requires an exact description match; a user calendar named `PersonalHub` is never adopted by title. No match creates one calendar, one match is reused, and multiple matches stop with `MULTIPLE_MANAGED_CALENDARS` for operator resolution rather than choosing or deleting one arbitrarily.

Lease acquisition is one atomic conditional PostgreSQL update. A live lease returns `SYNC_IN_PROGRESS`; successful and failed runs release their own lease in `finally`. The lease expires after ten minutes and is renewed before each provider mutation. Every Google request has a 15-second per-attempt deadline and at most three attempts, so a provider call cannot silently outlive the lease. This allows crash recovery without permitting rapid-click overlap. Lease timestamps are UTC instants generated by the application host, whose production clock is UTC-synchronized.

Google and PostgreSQL cannot share an ACID transaction. Item operations are therefore resumable and convergent. A partial run records a safe error code and reports failure, even if some earlier items succeeded; the next **Sync Now** resumes without duplicating managed events.

## Failures and disconnect

Google responses are validated. Credentials, authorization codes, Authorization headers, and complete provider response bodies are never logged. Structured logs contain only provider, operation, integration ID, bounded counts, duration, HTTP status category or safe error code, and success/failure.

Rate-limit responses (`403` rate-limit reasons or `429`) and transient `5xx`/network failures receive at most three attempts with bounded exponential delay; `Retry-After` is honored with a local cap. Google's Calendar error guide recommends exponential backoff for rate limits and backend errors:

- <https://developers.google.com/workspace/calendar/api/guides/errors>

`invalid_grant` marks the integration as requiring reauthorization and removes the unusable local encrypted credential. Other errors remain safe to retry.

Disconnect acquires the same integration lease as synchronization, so it fails safely with `SYNC_IN_PROGRESS` instead of racing an active projection run. It then attempts Google's revocation endpoint, removes the local encrypted refresh credential, and marks the integration disconnected. It preserves the dedicated calendar, managed events, calendar ID, and mappings to avoid surprising destructive cleanup and to support later reconnection. Google's web-server documentation describes token revocation:

- <https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke>

## Google Cloud setup

Do these steps personally; do not send credentials through chat.

1. Create or select a Google Cloud project.
2. Enable **Google Calendar API** in **APIs & Services > Library**.
3. Open **Google Auth Platform** and configure Branding, Audience, and contact details.
4. Under Data Access, declare only:
   - `https://www.googleapis.com/auth/calendar.app.created`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
5. Create an OAuth client of type **Web application**.
6. Add this exact authorized redirect URI:

   ```text
   https://personalhub.studexhub.com/api/v1/integrations/google/callback
   ```

7. Do not add wildcard, HTTP, localhost, alternate-host, or trailing-slash production redirects.
8. For an External app, add the owner Google account as a test user while testing. Before relying on durable offline authorization, move the app to **In production** and complete any Google verification that its scope/configuration requires.

Google currently limits Testing projects to 100 listed test users and expires their authorization, including refresh tokens for non-profile offline scopes, seven days after consent. In-production projects avoid this testing-mode seven-day expiry, though refresh tokens can still become invalid through revocation, inactivity, password/policy events, user limits, or other Google policy:

- <https://support.google.com/cloud/answer/15549945>
- <https://developers.google.com/identity/protocols/oauth2#expiration>

## Safe production provisioning (later authorization)

Terraform owns these `SecureString` parameters:

```text
/personalhub/production/google/client-id
/personalhub/production/google/client-secret
/personalhub/production/integration/encryption-key
```

The EC2 host role receives exact ARN access. GitHub build and deploy roles remain unchanged.

When separately authorized, enter the client ID and secret only through hidden local prompts. Generate the integration key locally from a cryptographically secure source and never print it. Supply all values as ephemeral Terraform variables using the repository's established write-only `value_wo` procedure. Re-plan with the real values immediately before an authorized apply; never apply a review plan built with placeholders.

## v3.3 boundary

v3.3 may evaluate background synchronization and inbound semantics after this manual one-way path is proven live. v3.2 intentionally does not include continuous sync, Google-to-PersonalHub imports, conflict resolution, webhooks, queues, or scheduled jobs.
