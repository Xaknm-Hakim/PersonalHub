# Local API

The API is for local clients only. In production the request guard accepts localhost hosts. Responses use either `{ "data": ... }` or `{ "error": { "code", "message", "fields"? } }`; validation failures include field details when available.

All routes are under `/api/v1`.

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

`dueDate` and other planning dates must be real `YYYY-MM-DD` values. They are calendar dates, not client-local timestamps. A missing task returns `404` with `NOT_FOUND`; malformed requests return a structured error rather than database details.

Example:

```bash
curl -X POST http://127.0.0.1:3002/api/v1/capture \
  -H 'content-type: application/json' \
  -d '{"title":"Call dentist","dueDate":"2026-09-12"}'
```
