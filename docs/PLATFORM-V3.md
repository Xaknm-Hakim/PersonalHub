# PersonalHub v3 platform boundary

PersonalHub v3 is a personal backend platform: it owns canonical operational state and exposes stable, authenticated APIs to small clients. The browser remains the rich management interface. Quickshell is the first external client and is deliberately limited to glance-and-capture behavior.

## v3.1 assessment

### A. Current external-client readiness

The existing `/api/v1` boundary is already suitable for a native desktop client. Every versioned endpoint requires a bearer token, returns machine-consumable JSON, uses normalized DTOs rather than Prisma records, applies bounded JSON-body handling, and converts validation and internal failures into non-sensitive errors. CORS remains disabled because Quickshell is not a browser-origin client.

### B. Existing API-token capabilities

`ApiToken` stores a public ID, SHA-256 secret digest, name, scopes, optional expiry, revocation and last-use metadata. Plaintext is shown once. Token parsing is strict, secret comparison is timing-safe, and malformed, unknown, expired, and revoked tokens share the same vague `401`. The owner-only Settings UI creates and revokes tokens. The existing `read` and `write` scopes are sufficient for v3.1; no second auth system or new scope vocabulary is justified.

### C. Existing endpoint contracts

v3.1 uses only:

- `GET /api/v1/today` with `read`, returning normalized current and overdue planning items;
- `GET /api/v1/upcoming` with `read`, returning the next seven days of normalized planning items;
- `POST /api/v1/capture` with `write`, creating a default `todo`/`medium` task from a title and optional planning date.

Planning items cover tasks, assignments, and project milestones without exposing table structure. Date-only values use `YYYY-MM-DD`; instants use ISO 8601. Lists are ordered by planning date and title.

### D. Gaps that blocked Quickshell

No server or schema gap blocked the first client. The missing pieces were client-side:

- a secure local token handoff;
- bounded HTTPS requests to the production API;
- strict response-shape checks;
- compact Today, Upcoming, and Quick Capture presentation;
- explicit unavailable, unauthorized, malformed-response, and missing-token states;
- external-client contract tests and documentation.

### E. What remains unchanged

v3.1 does not change the Prisma schema, browser-session model, API scope names, CORS policy, domain services, infrastructure, production topology, deployment machinery, or database access model. It does not add Google integration, OAuth, webhooks, queues, schedulers, notifications, integration credential tables, or duplicate client storage.

### F. Smallest v3.1 architecture

```text
Quickshell
    |
    | HTTPS + Authorization: Bearer <scoped token>
    v
personalhub.studexhub.com
    |
Cloudflare Tunnel
    |
PersonalHub /api/v1
    |
existing service/domain logic
    |
Prisma
    |
PostgreSQL
```

Quickshell invokes a bounded local adapter that reads one mode-`0600` token file, sends the credential only in an HTTPS authorization header, and validates response shapes before updating shell state. It has no database credential, direct EC2 route, private-IP route, SSH tunnel, or canonical data store.

## Ownership

PersonalHub owns:

- canonical tasks, projects, assignments, notes, and their semantics;
- authentication and authorization;
- planning-date and timezone interpretation;
- validation and business rules;
- the versioned API contract.

Clients own:

- presentation;
- local interaction;
- bounded network behavior;
- ephemeral loading, error, and input state.

Clients do not own:

- duplicate canonical databases;
- copies of PersonalHub business rules;
- direct PostgreSQL access;
- server credentials.

The PersonalHub API is the supported external-client boundary. Direct PostgreSQL access by any external client is unsupported.

## First-client scope

The Quickshell integration answers two questions only:

- What needs attention now or soon?
- What should be captured before it is forgotten?

The browser remains responsible for editing, organizing, reviewing, project management, and detailed planning.

## Planning labels

- v3.1: external-client foundation and Quickshell (complete)
- v3.2: Google integration foundation and manual one-way Calendar projection
- v3.3: continuous/background Calendar synchronization and possible inbound semantics
- v3.4: background jobs and notifications
- v3.5: Gmail-derived actions

These are planning labels, not architecture commitments. Each later milestone must justify its own storage and runtime machinery.

## v3.2: manual Google Calendar projection

v3.2 keeps PersonalHub authoritative and adds one bounded projection:

```text
PersonalHub -> dedicated Google Calendar -> Samsung Calendar
```

Settings owns the Google OAuth web-server flow and requests only
`calendar.app.created` plus `calendar.calendarlist.readonly`; the latter is
needed to recover an app-created calendar after a remote-success/local-failure
window. Refresh authorization is encrypted at rest with AES-256-GCM under a
dedicated SSM-materialized key. `Integration` stores the single Google
connection, renewable sync lease, and compact sync state; `ExternalResource`
maps each eligible local entity to its managed Google event.

`Sync Now` projects open dated tasks and assignments as all-day events. Stored
event IDs plus deterministic provider IDs make repeated runs idempotent and
resumable across the non-atomic Google/PostgreSQL boundary. Sources that are
deleted or become ineligible remove only their mapped managed event. Unrelated
Google events are never touched.

The calendar description carries a stable non-secret integration marker. A
missing recorded calendar is rediscovered by exact marker, never by title;
multiple marker matches stop safely for operator resolution. An atomic,
renewable, expiring PostgreSQL lease serializes manual sync requests.

Google-side edits are not imported and may be overwritten by the next manual
sync. Disconnect revokes authorization when possible and always erases the
local encrypted credential, while preserving the dedicated calendar and its
events. There is no background sync, webhook, queue, scheduler, inbound merge,
or conflict resolution in v3.2.

See [Google Calendar projection](./GOOGLE-CALENDAR.md) for OAuth, encryption,
Google Cloud setup, reconciliation, and production provisioning details.
