# PersonalHub API

Every `/api/v1/*` request requires `Authorization: Bearer <token>`. Browser session cookies are not accepted as API authentication. Responses use either `{ "data": ... }` or `{ "error": { "code", "message", "fields"? } }`; validation failures include field details when available. CORS is disabled.

Versioned routes are under `/api/v1`. GET routes require `read`; mutation routes require `write`.

| Method  | Route                 | Purpose                                                                   |
| ------- | --------------------- | ------------------------------------------------------------------------- |
| `GET`   | `/today`              | Returns `{ today, overdue }` planning items.                              |
| `GET`   | `/upcoming`           | Returns upcoming planning items.                                          |
| `POST`  | `/capture`            | Creates a task from `title` and optional `dueDate`.                       |
| `GET`   | `/tasks`              | Lists tasks; `status`, `priority`, `q`, and `tagId` are optional filters. |
| `POST`  | `/tasks`              | Creates a task.                                                           |
| `GET`   | `/tasks/:id`          | Gets one task.                                                            |
| `PATCH` | `/tasks/:id`          | Updates one task.                                                         |
| `POST`  | `/tasks/:id/complete` | Marks one task complete.                                                  |

`dueDate` and other planning dates must be real `YYYY-MM-DD` values. They are calendar dates, not client-local timestamps. JSON bodies are limited to 64 KiB and require a JSON media type. A missing task returns `404` with `NOT_FOUND`; malformed requests return a structured error rather than database details. Authentication failures return a vague `401`; a valid token without the needed scope returns `403`.

`GET /api/health` is unversioned and public. It returns `{ "status": "ok" }` only when the database readiness query succeeds, without exposing database details.

Example:

```bash
curl -X POST http://127.0.0.1:3002/api/v1/capture \
  -H "Authorization: Bearer $PERSONALHUB_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"title":"Call dentist","dueDate":"2026-09-12"}'
```
