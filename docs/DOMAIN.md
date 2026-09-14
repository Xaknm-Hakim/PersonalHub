# Domain Contract

PersonalHub is a single-user local planner. It has no authentication, cloud sync, hosting, team workspace, or external integrations.

- Tasks have title, optional description and dates, status, priority, optional project, and tags.
- Assignments have course details, type, required deadline, status, priority, optional start date, and tags.
- Projects track status, type, priority, optional planning dates, optional references, and linked tasks/notes.
- Notes require title and body and can link to a task, assignment, project, and tags.
- Tags are reusable names with an optional color.

Planning dates are validated `YYYY-MM-DD` values stored as PostgreSQL `DATE`s. They represent calendar days at UTC midnight and must not be treated as local instants. Task and assignment closed status logic is shared by planning surfaces so completed work does not appear as open overdue work.

Project statuses are `planned`, `developing`, `active`, `paused`, `completed`, `archived`, and `abandoned`. Priority is `low`, `medium`, `high`, or `urgent`.
