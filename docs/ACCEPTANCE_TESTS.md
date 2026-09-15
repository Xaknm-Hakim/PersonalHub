# Acceptance Tests

> Run against `http://127.0.0.1:3002` after `npm run docker:up` and one-time owner bootstrap. Also verify quick capture, task project/tag links, note project link, a visible project task, a tag filter, and bearer-authenticated `/api/v1/today`.

## Manual test cases

- An unauthenticated product route redirects to login.
- Incorrect login fails vaguely; correct login creates a session; logout removes access.
- Settings creates a named scoped API token, shows its plaintext once, lists only metadata, and revokes it.
- Anonymous and revoked bearer requests fail; a valid bearer request succeeds.
- `/api/health` returns only a non-sensitive readiness result.
- Can create, edit, and delete a task.
- Can create, edit, and delete an assignment.
- Can create an assignment with a type and without weight or marks.
- Can create a project.
- Can edit a project.
- Can delete a project.
- Can filter projects by status.
- Can filter projects by type.
- Can filter projects by priority.
- Can sort projects by recently updated, start date, target date, and title.
- Can store project repository URL, local path, and live URL.
- Can create, edit, and delete a note.
- Data persists after refresh.
- Dashboard shows overdue and upcoming items.
- Dashboard shows developing/active projects, paused project count, recently updated projects, and next project actions.
- Timeline shows tasks and assignments correctly.
- Timeline shows projects when start date exists and target date or completed date exists.
- Calendar shows task due dates and assignment deadlines.
- Calendar shows project target and completed milestone items.
- Calendar previous month, next month, and today controls work.
- Filters work on tasks, assignments, projects, and timeline.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test` complete before release review.
- `npm run test:integration` completes with its disposable PostgreSQL container; it must not connect to the Compose or legacy database.
- The isolated Compose app and PostgreSQL services report healthy at `http://127.0.0.1:3002` and `127.0.0.1:5433`.
