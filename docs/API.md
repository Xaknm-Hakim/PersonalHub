# PersonalHub API

The versioned API at `https://personalhub.studexhub.com/api/v1` is the supported boundary for native and automated clients. External clients must never connect to PostgreSQL directly.

## Authentication and scopes

Every `/api/v1/*` request requires an API token in an HTTP header:

```text
Authorization: Bearer <FAKE_OR_LOCAL_TOKEN>
```

Browser session cookies are not accepted as API authentication. Tokens are created and revoked by the authenticated owner in Settings and are shown in plaintext only once. Use the minimum existing scopes:

- `read`: GET endpoints, including Today and Upcoming;
- `write`: capture, create, update, and completion endpoints.

The Quickshell client needs both `read` and `write`. These scopes do not grant owner bootstrap, browser-session, token-management, infrastructure, or direct database access.

Never put a token in a query string, source file, Git repository, log, or command example. Examples below use placeholders only.

## Response and error contract

Successful versioned responses use:

```json
{ "data": {} }
```

Failures use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": { "title": "Required" }
  }
}
```

`fields` is present only for field validation errors. Internal stack traces, Prisma errors, database details, credentials, and raw provider errors are never returned.

Status semantics:

- `200`: successful read or update;
- `201`: successful creation or capture;
- `400 INVALID_JSON`: malformed or empty JSON;
- `401 UNAUTHORIZED`: missing, malformed, unknown, expired, or revoked token;
- `403 INSUFFICIENT_SCOPE`: valid token without the required scope;
- `404 NOT_FOUND`: requested task does not exist;
- `413 PAYLOAD_TOO_LARGE`: a JSON-body endpoint receives more than 64 KiB;
- `415 UNSUPPORTED_MEDIA_TYPE`: a JSON-body endpoint receives a non-JSON media type;
- `422 VALIDATION_ERROR`: structurally or semantically invalid input;
- `500 INTERNAL_ERROR`: safe generic internal failure.

Successful and authentication responses use `Cache-Control: no-store`. A `401` also includes `WWW-Authenticate: Bearer realm="PersonalHub"`.

## External-client endpoints

### `GET /api/v1/today`

Requires `read`. Returns open planning items due today plus overdue items. Items can represent tasks, assignment deadlines, or project milestones.

```json
{
  "data": {
    "today": [
      {
        "id": "example-task-id",
        "entity": "task",
        "event": "due",
        "title": "Review notes",
        "date": "2026-09-28",
        "startDate": null,
        "status": "todo",
        "priority": "medium",
        "group": "Tasks",
        "href": "/tasks?edit=example-task-id",
        "closed": false,
        "overdue": false,
        "category": null
      }
    ],
    "overdue": []
  }
}
```

### `GET /api/v1/upcoming`

Requires `read`. Returns open planning items from tomorrow through seven days from today as a `data` array using the same planning-item shape.

### `POST /api/v1/capture`

Requires `write` and `Content-Type: application/json`. Creates a task with `todo` status and `medium` priority. Only `title` is required; `dueDate` is optional.

Request:

```json
{ "title": "Call dentist", "dueDate": "2026-10-02" }
```

Response:

```json
{
  "data": {
    "id": "example-created-id",
    "title": "Call dentist",
    "description": null,
    "status": "todo",
    "priority": "medium",
    "startDate": null,
    "dueDate": "2026-10-02",
    "completedAt": null,
    "projectId": null,
    "tags": []
  }
}
```

Unknown properties are rejected. Capture intentionally does not require a project, tag, description, or priority: capture first, organize later.

## Other task endpoints

| Method  | Route                        | Scope   | Purpose                                                                  |
| ------- | ---------------------------- | ------- | ------------------------------------------------------------------------ |
| `GET`   | `/api/v1/tasks`              | `read`  | List tasks; `status`, `priority`, `q`, and `tagId` are optional filters. |
| `POST`  | `/api/v1/tasks`              | `write` | Create a task.                                                           |
| `GET`   | `/api/v1/tasks/:id`          | `read`  | Get one task.                                                            |
| `PATCH` | `/api/v1/tasks/:id`          | `write` | Update one task.                                                         |
| `POST`  | `/api/v1/tasks/:id/complete` | `write` | Mark one task complete idempotently.                                     |

v3.1 does not require these endpoints from Quickshell.

## Date, time, null, and ordering semantics

Planning dates are calendar dates represented as real `YYYY-MM-DD` values, not client-local timestamps. PersonalHub classifies Today and Upcoming in `PERSONALHUB_TIME_ZONE`, currently `Asia/Kuala_Lumpur`. External clients should render the returned date and classification rather than reimplementing server planning rules.

Instants such as `completedAt` are ISO 8601 UTC strings. Optional relationships and absent planning values are explicit `null`, not omitted or empty strings. Planning lists are deterministic: date ascending, then title ascending.

## Native-client request example

The token below is a shell variable populated locally; it is not a literal token:

```bash
curl --fail-with-body --silent --show-error \
  --connect-timeout 3 --max-time 7 \
  -H "Authorization: Bearer $PERSONALHUB_API_TOKEN" \
  https://personalhub.studexhub.com/api/v1/today
```

Do not use verbose HTTP tracing while a real authorization header is present.

## Browser and network boundary

CORS is intentionally disabled. Quickshell performs native HTTPS requests and does not use the browser same-origin model. A future browser client on another origin requires a specific allowlist; permissive `*` CORS is not part of this contract.

`GET /api/health` is unversioned and public. It returns `{ "status": "ok" }` only when the database readiness query succeeds and exposes no database details.
