# Domain Contract

PersonalHub is a privately hosted, single-owner productivity application. Its browser interface uses owner authentication, and trusted machine clients use the versioned API with scoped bearer tokens; external clients do not access the database directly. It is not a multi-user SaaS or team workspace.

- Tasks have title, optional description and dates, status, priority, optional project, and tags.
- Assignments have course details, type, required deadline, status, priority, optional start date, and tags.
- Projects track status, type, priority, optional planning dates, optional references, and linked tasks/notes.
- Notes require title and body and can link to a task, assignment, project, and tags.
- Tags are reusable names with an optional color.
- The versioned API exposes bounded planning, capture, and task operations according to token scope; it is not general external CRUD for every domain.
- Google Calendar receives a manual, one-way projection of eligible dated tasks and assignments. Calendar edits are not imported, and no background synchronization is implemented.

Planning dates are validated `YYYY-MM-DD` values stored as PostgreSQL `DATE`s. They represent calendar days at UTC midnight and must not be treated as local instants. Task and assignment closed status logic is shared by planning surfaces so completed work does not appear as open overdue work.

Project statuses are `planned`, `developing`, `active`, `paused`, `completed`, `archived`, and `abandoned`. Priority is `low`, `medium`, `high`, or `urgent`.
