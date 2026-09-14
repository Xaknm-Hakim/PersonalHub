# Product Spec

> Runtime update: PostgreSQL is the canonical datastore. Tasks and notes can belong to projects; tags classify tasks, assignments, and notes. Planning dates are validated `YYYY-MM-DD` calendar dates rather than user-local instants.

## App purpose

PersonalHub is a local-first productivity app for one person using a laptop browser on localhost. It helps track diploma/student tasks, assignments, notes, private projects, deadlines, calendar dates, and simple Gantt-style planning.

## MVP scope

- Dashboard with today, overdue, upcoming, recent notes, and stats.
- Tasks CRUD with status, priority, dates, filters, and overdue labels.
- Assignments CRUD with course, type, status, priority, dates, filters, and overdue labels.
- Projects CRUD for personal, technical, academic, event/operations, and lab-style project memory.
- Notes CRUD with optional task or assignment links, search, and latest-updated sorting.
- Timeline with tasks, assignments, and dated projects grouped into a CSS-based horizontal plan.
- Calendar with month navigation, task due dates, assignment deadlines, and project target/completion milestones.
- Settings/About page with local-first explanation and version.
- Light/dark mode toggle with local browser persistence.

## Page descriptions

- Dashboard: summarizes immediate work and study deadlines.
- Tasks: creates, edits, deletes, filters, and sorts personal tasks.
- Assignments: manages coursework deadlines and progress.
- Projects: tracks what has been done, what is being developed, current progress, next action, links, stack, and lessons learned.
- Notes: stores study notes and links them to work items where useful.
- Timeline: shows assignments, tasks, and projects on a simple horizontal date range.
- Calendar: shows a navigable monthly view of due dates, deadlines, and project milestones.
- Settings/About: documents the local-only intent.

## Data model overview

- Task: title, description, status, priority, optional start date, optional due date.
- Assignment: course, type, title, description, status, priority, optional start date, and required deadline.
- Project: title, description, status, type, priority, optional dates, repository URL, local path, live URL, tech stack, objective, current progress, next action, and lessons learned.
- Note: title, body, optional linked task, optional linked assignment.
- Tag: reusable name and optional color.
- Tasks, assignments, and notes can each have many tags.

## Projects

Projects is not a GitHub clone and not a team project management app. It is a private memory and control panel for personal projects.

Project statuses:

- `planned`: accepted idea, not started yet
- `developing`: actively being built
- `active`: usable, maintained, or currently running
- `paused`: temporarily stopped, may continue later
- `completed`: finished its intended scope
- `archived`: preserved for reference, no longer active
- `abandoned`: intentionally dropped

Project types:

- `software`
- `infrastructure`
- `networking`
- `cloud`
- `academic`
- `event_ops`
- `lab`
- `documentation`
- `other`

Priority values are `low`, `medium`, `high`, and `urgent`.

Dashboard integration is intentionally compact: it shows developing/active projects, paused project count, recently updated projects, and projects with next actions. The full project list stays on `/projects`.

Timeline integration is basic: projects appear only when `startDate` exists and either `targetDate` or `completedAt` exists. The timeline uses `completedAt` as the end date when available, otherwise `targetDate`.

Calendar integration is milestone-only: `targetDate` appears as a project target item and `completedAt` appears as a project completed item. Full project duration bars are not shown in Calendar.

## Explicit non-goals

- Authentication
- Team, workspace, or public sharing features
- Payments or SaaS billing
- Google Calendar integration
- Cloud sync
- AI features
- Email or Telegram notifications
- GitHub API integration
- Kanban boards
- Milestones
- File uploads
- Automatic local folder scanning
