# Product Spec

## App purpose

PersonalHub is a local-first productivity app for one person using a laptop browser on localhost. It helps track diploma/student tasks, assignments, notes, deadlines, calendar dates, and simple Gantt-style planning.

## MVP scope

- Dashboard with today, overdue, upcoming, recent notes, and stats.
- Tasks CRUD with status, priority, dates, filters, and overdue labels.
- Assignments CRUD with course, type, status, priority, dates, filters, and overdue labels.
- Notes CRUD with optional task or assignment links, search, and latest-updated sorting.
- Timeline with tasks and assignments grouped into a CSS-based horizontal plan.
- Calendar with month navigation, task due dates, and assignment deadlines.
- Settings/About page with local-first explanation, database path, and version.
- Light/dark mode toggle with local browser persistence.

## Page descriptions

- Dashboard: summarizes immediate work and study deadlines.
- Tasks: creates, edits, deletes, filters, and sorts personal tasks.
- Assignments: manages coursework deadlines and progress.
- Notes: stores study notes and links them to work items where useful.
- Timeline: shows assignments and tasks on a simple horizontal date range.
- Calendar: shows a navigable monthly view of due dates and deadlines.
- Settings/About: documents the local-only intent and database location.

## Data model overview

- Task: title, description, status, priority, optional start date, optional due date.
- Assignment: course, type, title, description, status, priority, optional start date, and required deadline.
- Note: title, body, optional linked task, optional linked assignment.
- Tag: reusable name and optional color.
- Tasks, assignments, and notes can each have many tags.

## Explicit non-goals

- Authentication
- Team, workspace, or public sharing features
- Payments or SaaS billing
- Google Calendar integration
- Cloud sync
- AI features
- Email or Telegram notifications
- Docker
- PostgreSQL
