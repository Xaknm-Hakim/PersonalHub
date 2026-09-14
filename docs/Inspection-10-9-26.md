# PersonalHub Current-State Inspection

## 1. Executive Summary

PersonalHub is a small local-first Next.js App Router application backed by Prisma and SQLite. It is designed for one user on localhost, with no authentication, cloud sync, team features, external integrations, or API layer.

The implemented application currently provides:

- Dashboard with task, assignment, project, and note summaries
- Task CRUD, filtering, sorting by due date, and overdue detection
- Assignment CRUD, course/type/status/priority filtering, and overdue detection
- Project CRUD, filtering, sorting, links, project memory fields, and lifecycle statuses
- Note CRUD, text search, and optional links to tasks and assignments
- Timeline view across tasks, assignments, and projects
- Calendar view across task deadlines, assignment deadlines, and project milestones
- Light/dark theme selection
- Collapsible sidebar
- Local SQLite backup and restore scripts
- Docker-based production-mode local operation

The main architecture is intentionally simple:

UI Server Components
→ Server Actions
→ Prisma Client
→ SQLite

Important current-state findings:

- Tags exist in the schema and seed data but have no user-facing UI, actions, or query integration.
- All CRUD operations are centralized in `app/actions.ts`.
- Most page components combine database queries, filtering, form definitions, list rendering, and feature-specific presentation in the same file.
- There are no route handlers, REST APIs, automated tests, loading boundaries, or error boundaries.
- Validation is mostly manual and incomplete server-side.
- The current working tree contains an uncommitted `AppShell` extraction from `app/layout.tsx` into `components/app-shell.tsx`.
- The checked-in SQLite database currently contains five projects and five tags, but no tasks, assignments, or notes. The seed script would create a fuller demo dataset but is destructive and was not executed.

## 2. Repository Structure

### Application routes

- `app/layout.tsx`
  - Root HTML layout
  - Metadata
  - Theme bootstrap script
  - Wraps the application in `ThemeProvider` and `AppShell`

- `app/page.tsx`
  - Dashboard route at `/`
  - Performs the largest aggregate set of database queries
  - Renders task, assignment, project, note, and statistic summaries

- `app/tasks/page.tsx`
  - `/tasks`
  - Task listing, filters, create/edit form, delete action

- `app/assignments/page.tsx`
  - `/assignments`
  - Assignment listing, filters, create/edit form, delete action

- `app/projects/page.tsx`
  - `/projects`
  - Project listing, filters, sorting, create/edit form, delete action

- `app/notes/page.tsx`
  - `/notes`
  - Note listing, text search, links to tasks/assignments, create/edit form, delete action

- `app/timeline/page.tsx`
  - `/timeline`
  - Combined date-range visualization for tasks, assignments, and projects

- `app/calendar/page.tsx`
  - `/calendar`
  - Six-week month grid with task, assignment, and project milestone events

- `app/settings/page.tsx`
  - `/settings`
  - Static About/settings page

### Shared components

- `components/app-shell.tsx`
  - Current client-side application shell
  - Sidebar navigation, responsive navigation, sidebar persistence, theme toggle placement
  - This file is untracked in the current working tree

- `components/page-header.tsx`
  - Shared page title and description

- `components/empty-state.tsx`
  - Shared empty-state presentation

- `components/theme-provider.tsx`
  - Client-side theme state and localStorage persistence

- `components/theme-toggle.tsx`
  - Client-side light/dark toggle

### UI primitives

- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/textarea.tsx`

These are local shadcn/ui-style primitives using Tailwind classes, `class-variance-authority`, `clsx`, and `tailwind-merge`.

### Server-side/domain support

- `app/actions.ts`
  - All current Server Actions
  - CRUD operations for tasks, assignments, projects, and notes

- `lib/prisma.ts`
  - Singleton Prisma client pattern using `globalThis` in development

- `lib/projects.ts`
  - Project-specific query helpers
  - Project filtering, sorting, counts, timeline lookup, and calendar milestone lookup

- `lib/constants.ts`
  - Allowed status, type, and priority strings

- `lib/utils.ts`
  - Class merging
  - Date formatting/parsing
  - Overdue detection
  - Status labels
  - Priority badge classes

### Persistence and migrations

- `prisma/schema.prisma`
  - Current Prisma domain model

- `prisma/seed.ts`
  - Destructive demo-data reset and seed script

- `prisma/migrations/`
  - Three SQLite migrations:
    - Initial schema
    - Assignment type addition and grading-field removal
    - Project model addition

- `data/personalhub.db`
  - Local SQLite database
  - Ignored by Git

### Operations

- `Dockerfile`
  - Multi-stage Node 22 image
  - Prisma generation and Next.js build
  - Production runner

- `docker-compose.yml`
  - One `personalhub` service
  - Host port `3001` mapped to container port `3000`
  - `./data` bind-mounted to `/app/data`

- `docker-entrypoint.sh`
  - Creates `/app/data`
  - Runs `prisma migrate deploy`
  - Starts Next.js

- `scripts/backup-db.sh`
  - Copies the SQLite database to a timestamped backup

- `scripts/restore-db.sh`
  - Requires a backup path and typed `YES`
  - Creates a safety backup before replacement

- `Makefile`
  - npm, Docker, Prisma, backup, restore, status, check, and cleanup shortcuts

### Documentation

- `README.md`
  - Setup, development, Docker, backup/restore, and database instructions

- `docs/PRODUCT_SPEC.md`
  - Product scope and domain description

- `docs/ROADMAP.md`
  - Version 0.1 scope and future ideas

- `docs/ACCEPTANCE_TESTS.md`
  - Manual acceptance checklist

### Configuration

- `package.json`, `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `tailwind.config.ts`
- `postcss.config.mjs`
- `.eslintrc.json`
- `.prettierrc`
- `.env.example`
- `.gitignore`
- `.dockerignore`

There is no CI/CD configuration, no automated test directory, and no API route directory.

## 3. Architecture Overview

The current system is a mostly server-rendered CRUD application.

### Request/rendering path

1. Next.js App Router resolves a route.
2. The route’s Server Component reads URL search parameters.
3. The route directly queries Prisma or calls helpers from `lib/projects.ts`.
4. The route renders forms and result lists.
5. Forms invoke Server Actions from `app/actions.ts`.
6. Server Actions parse form values and write through Prisma.
7. Actions call `revalidatePath`.
8. Update actions additionally redirect back to the relevant route.
9. The refreshed Server Component queries the database again.

### Layer structure

UI and route composition:

- `app/*/page.tsx`
- `components/*`
- `components/ui/*`

Mutation layer:

- `app/actions.ts`

Query/helper layer:

- Direct Prisma calls in page components
- Project helper functions in `lib/projects.ts`

Persistence:

- Prisma Client from `lib/prisma.ts`
- SQLite configured through `DATABASE_URL`

Operational layer:

- Prisma migrations
- Docker Compose
- Backup and restore shell scripts

### Architectural boundaries

The boundaries are fairly thin:

- Route components own both data retrieval and presentation.
- Server Actions own parsing, validation of enumerated values, persistence, and revalidation.
- `lib/projects.ts` is the only meaningful feature query module.
- There is no general repository/service/domain layer.
- There is no shared form abstraction.
- There is no central error/result convention.

## 4. Route / Page Inventory

### `/` — Dashboard

File: `app/page.tsx`

Purpose:

- Immediate overview of current work, overdue work, upcoming deadlines, projects, and recent notes.

Database queries:

- Tasks due today
- Overdue tasks
- Assignments due within seven days
- Five most recently updated notes
- Open task count for statuses `todo` and `doing`
- Completed task count for status `done`
- Assignment count due within seven days
- Overdue assignment count
- Overdue assignment records
- Up to 20 projects for active-project filtering
- Paused project count
- Three recently updated projects
- Up to 20 projects for next-action filtering

Dashboard sections:

- Four stats:
  - Open tasks
  - Completed tasks
  - Assignments due this week
  - Overdue items
- Today’s tasks
- Overdue tasks
- Overdue assignments
- Assignments due within seven days
- Projects:
  - Developing or active
  - Projects with next actions
  - Recently updated projects
  - Paused count
- Five recent notes

Navigation:

- Items link to edit forms through query parameters such as `/tasks?edit=...`.
- Overdue assignment card includes a link to `/assignments`.

Filtering/search:

- No dashboard URL filters.
- Dashboard applies fixed database filters and application-side project filtering/sorting.

Empty states:

- Each summary section has an empty state.
- Recent notes uses the shared `EmptyState`.

Error/loading behavior:

- No explicit loading or error UI.
- Database errors propagate through the route.

Completeness:

- Implemented and actively used.
- It is more than a landing page: it is an aggregate work/deadline dashboard.

Notable semantics:

- Assignment “closed” statuses are `submitted`, `graded`, `completed`, and `cancelled` in the dashboard, although `completed` is not included in the assignment status constants or form options.
- Overdue assignments are sorted application-side by priority, then oldest deadline.
- Project records are queried broadly, then filtered in memory for active and next-action sections.

### `/tasks` — Tasks

File: `app/tasks/page.tsx`

Purpose:

- Manage personal tasks.

Data:

- Direct Prisma task listing
- Optional task selected by `edit` query parameter

Filters:

- `status`
- `priority`

Sorting:

- `dueDate` ascending
- `createdAt` descending

User actions:

- Create task
- Edit task
- Delete task
- Filter tasks

Form fields:

- Title
- Description
- Status
- Priority
- Start date
- Due date

Validation:

- Browser `required` for title
- Server-side enum validation for status and priority
- Server-side date parsing
- Title/description are not non-empty validated server-side

Display:

- Title, description, dates, status, priority
- Overdue badge for incomplete tasks with dates before today

Empty state:

- “No tasks found”

Mutation actions:

- `createTask`
- `updateTask`
- `deleteTask`

Completeness:

- Implemented and actively used.

### `/assignments` — Assignments

File: `app/assignments/page.tsx`

Purpose:

- Manage coursework and academic deadlines.

Data:

- Distinct course codes
- Assignment listing
- Optional assignment selected by `edit`

Filters:

- Course code
- Assignment type
- Status
- Priority

Sorting:

- Deadline ascending

User actions:

- Create assignment
- Edit assignment
- Delete assignment
- Filter assignments

Form fields:

- Course code
- Course name
- Title
- Description
- Type
- Status
- Priority
- Start date
- Required deadline

Validation:

- Browser `required` for course code, course name, title, deadline
- Server-side enum validation
- Server-side date parsing
- Missing deadline falls back to `new Date()` in the Server Action instead of failing

Display:

- Course code/title
- Course name
- Description
- Deadline
- Type, status, priority badges
- Overdue badge for non-closed statuses

Completeness:

- Implemented and actively used.

Notable discrepancy:

- Dashboard recognizes `completed` as a closed assignment status, but `assignmentStatuses` does not include it. The schema is string-based, so the value could exist in the database even though the normal UI does not offer it.

### `/projects` — Projects

File: `app/projects/page.tsx`

Purpose:

- Personal project memory and control panel.

Data:

- Project queries are routed through `lib/projects.ts`.
- Optional project selected by `edit`.

Filters:

- Status
- Type
- Priority

Sorting:

- Recently updated
- Start date
- Target date
- Title

User actions:

- Create project
- Edit project
- Delete project
- Filter projects
- Sort projects
- Open repository/live URLs in a new tab

Form fields:

- Title
- Description
- Status
- Type
- Priority
- Start date
- Target date
- Completed date
- Repository URL
- Local path
- Live URL
- Tech stack
- Objective
- Current progress
- Next action
- Lessons learned

Display:

- Status, type, priority
- Project details
- External links
- Local path
- Dates
- Lessons learned

Completeness:

- Implemented and actively used.

Not implemented:

- Project search
- Project tags
- Milestones
- Project activity history
- Automatic repository/local-path integration
- Kanban behavior
- Project relationships to tasks or assignments

### `/notes` — Notes

File: `app/notes/page.tsx`

Purpose:

- Store study notes, ideas, references, and work-linked notes.

Data:

- Notes with linked task and assignment included
- Optional note for editing
- All tasks for the link selector
- All assignments for the link selector

Search:

- `q` URL parameter
- Searches note title or body using Prisma `contains`

Sorting:

- `updatedAt` descending

User actions:

- Create note
- Edit note
- Delete note
- Search notes
- Link a note to one task and/or one assignment

Form fields:

- Title
- Body
- Linked task
- Linked assignment

Validation:

- Browser `required` for title and body
- Server-side linked task and assignment existence checks
- No explicit server-side non-empty title/body validation

Display:

- Title
- Body preview
- Updated date
- Linked task badge
- Linked assignment course badge

Completeness:

- Implemented and actively used.

### `/timeline` — Timeline

File: `app/timeline/page.tsx`

Purpose:

- Display tasks, assignments, and projects in a CSS-based horizontal date plan.

Data:

- Tasks unless filtering to assignments/projects
- Assignments unless filtering to tasks/projects
- Projects through `findTimelineProjects`

Supported items:

- Assignments:
  - Start date or creation date
  - Deadline
- Tasks:
  - Only tasks with a due date
  - Start date or creation date
  - Due date
- Projects:
  - Only projects with a start date and either target or completed date
  - Completed date is preferred as end date, otherwise target date

Filters:

- Item type: all/tasks/assignments/projects
- Status
- Range: this week, this month, all

Navigation:

- Previous month
- Today
- Next month

Rendering:

- Grouped into Assignments, Tasks, and Projects
- Date ticks calculated dynamically
- Today marker when visible
- Bars clipped to visible range
- Overdue bars rendered red
- Links point to edit forms

Empty state:

- Explains that dated tasks, assignments, or projects are required
- Links to creation pages

Completeness:

- Implemented and actively used.

Notable behavior:

- Status filter is a shared string filter across all entity types.
- The form manually combines statuses from different domains.
- “All” range uses the min/max dates of the loaded items.
- Timeline does not use pagination or database date-range filtering; it loads the relevant entity sets and filters in application code.

### `/calendar` — Calendar

File: `app/calendar/page.tsx`

Purpose:

- Month-oriented date view.

Data:

- Tasks with due dates within the six-week visible grid
- Assignments with deadlines within the visible grid
- Projects with target dates within the grid
- Projects with completed dates within the grid

Events:

- Task
- Assignment type
- Project target
- Project completed

Navigation:

- Previous month
- Today
- Next month

Rendering:

- Fixed six-week, 42-day grid
- Events link to corresponding edit forms
- Current day highlighted
- Events outside the selected month but inside the grid are shown with muted styling
- Overdue events receive red styling

Completeness:

- Implemented and actively used.

Scope:

- Project milestones only.
- It does not render full project duration bars.
- Tasks without due dates do not appear.
- Assignment records always have a deadline at the schema level.

### `/settings` — Settings/About

File: `app/settings/page.tsx`

Purpose:

- Static product/about information.

Content:

- Local-first intent
- No authentication, sharing, cloud sync, team workspaces, payments, AI, or external calendars
- Database path
- Version `0.1.0`

User actions:

- None.

Completeness:

- Implemented as a static informational page.
- No actual application settings are managed here.

## 5. Component Inventory

### Application shell

#### `AppShell`

File: `components/app-shell.tsx`

Responsibility:

- Global page layout
- Sidebar navigation
- Responsive horizontal navigation on smaller screens
- Collapsible desktop sidebar
- Sidebar localStorage persistence
- Theme toggle placement

Consumers:

- Root layout only

State:

- `sidebarOpen`

Storage:

- `personalhub-sidebar-open` in browser localStorage

Coupling:

- Hard-coded navigation list
- Depends on `ThemeToggle`, `Button`, and `cn`
- Controls global layout width classes

Current repository state:

- Untracked file
- Extracted from the previously inline layout implementation

#### `ThemeProvider`

File: `components/theme-provider.tsx`

Responsibility:

- Applies light/dark class to `<html>`
- Reads and writes `personalhub-theme`
- Uses system preference when no saved preference exists

State:

- Theme state exists only inside `useTheme`
- The provider itself does not expose React context

Important coupling:

- `ThemeToggle` uses `useTheme`
- Root layout also has an inline pre-hydration theme script to reduce visual flash

#### `ThemeToggle`

File: `components/theme-toggle.tsx`

Responsibility:

- Toggles light/dark theme
- Uses Moon/Sun icons

Consumer:

- `AppShell`

### Shared presentation

#### `PageHeader`

File: `components/page-header.tsx`

Responsibility:

- Standard page title and optional description

Consumers:

- Tasks
- Assignments
- Projects
- Notes
- Settings
- Dashboard

#### `EmptyState`

File: `components/empty-state.tsx`

Responsibility:

- Standard dashed-border empty presentation

Consumers:

- Dashboard
- Tasks
- Assignments
- Projects
- Notes

### UI primitives

#### `Button`

File: `components/ui/button.tsx`

Responsibility:

- Button styling variants
- Supports `asChild` through Radix Slot
- Variants:
  - default
  - secondary
  - outline
  - ghost
  - destructive
- Sizes:
  - default
  - small
  - icon

#### `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`

File: `components/ui/card.tsx`

Responsibility:

- Shared card layout and spacing

#### `Badge`

File: `components/ui/badge.tsx`

Responsibility:

- Status, priority, type, and metadata labels

#### `Input`

File: `components/ui/input.tsx`

Responsibility:

- Styled native input

#### `Select`

File: `components/ui/select.tsx`

Responsibility:

- Styled native select

#### `Textarea`

File: `components/ui/textarea.tsx`

Responsibility:

- Styled native textarea

### Feature-specific components and helpers

Most feature-specific “components” are local functions within route files rather than separate files.

- Dashboard:
  - `OverdueAssignmentsCard`
  - `ProjectList`
  - `SummaryCard`
  - `ItemRow`

- Tasks:
  - `TaskForm`

- Assignments:
  - `AssignmentForm`

- Projects:
  - `ProjectCard`
  - `ProjectLink`
  - `Detail`
  - `ProjectForm`

- Notes:
  - `NoteForm`

- Timeline:
  - Primarily inline rendering logic and local date/range helpers

- Calendar:
  - Primarily inline rendering logic and local date helpers

This means route files are responsible for both feature orchestration and local component implementation.

### Repeated UI/behavior

Repeated patterns include:

- Create/edit forms with the same page-local structure
- Delete forms with hidden IDs
- Status and priority badges
- Empty-state handling
- `?edit=<id>` navigation
- Date input formatting
- Filter forms using GET query parameters
- `revalidatePath` calls after mutations
- Project/task/assignment list item links back to edit forms

## 6. Functional Inventory

### Implemented and actively used

- Dashboard summaries
- Task create/edit/delete
- Task status and priority filtering
- Task overdue detection
- Assignment create/edit/delete
- Assignment course/type/status/priority filtering
- Assignment overdue detection
- Project create/edit/delete
- Project status/type/priority filtering
- Project sorting
- Project repository/live URL links
- Note create/edit/delete
- Note search
- Task and assignment links from notes
- Timeline navigation
- Timeline type/status/range filters
- Calendar month navigation
- Calendar task and assignment events
- Calendar project target/completion events
- Theme persistence
- Sidebar collapse persistence
- Local SQLite persistence
- Docker operation
- Database migration on container startup
- Database backup
- Database restore with confirmation and safety backup

### Implemented but incomplete or constrained

#### Tags

Structural support exists:

- `Tag` model
- Many-to-many relationships with tasks, assignments, and notes
- Seed data
- Migration tables and indexes

However:

- No tag route
- No tag form
- No tag Server Actions
- No tag filters
- No tags displayed in normal pages
- No tag editing or deletion
- Existing tagged records are not loaded with tags in the main UI

Classification: implemented structurally but incomplete end-to-end.

#### Project completion semantics

A `completedAt` field exists and can be manually entered, but:

- Changing status to `completed` does not automatically set `completedAt`
- Changing away from `completed` does not clear it
- No transition-specific action exists

Classification: implemented as a manually stored field, but business lifecycle behavior is incomplete.

#### Settings

The route exists but only displays information.

Classification: implemented informational page, not an actual settings system.

#### Search

Notes have title/body search. Tasks, assignments, projects, timeline, and calendar do not have general text search.

Classification: implemented narrowly.

### Implemented but apparently unused

- `Tag` runtime relationships outside seed data
- `Tag.color` in application UI
- `findProjectById` is used by the projects edit flow, so it is not unused
- Several UI primitive exports such as `CardDescription` are not visibly used in the inspected routes

### Stub/placeholder

No explicit `TODO` or “not implemented” runtime stubs were found.

### Potentially obsolete/dead or historical residue

- Initial migration includes assignment `weight` and `marks`, but those fields were removed by the second migration and are absent from the current schema and UI.
- Product documentation still describes tags as part of the data model, but the UI does not implement tags.
- Seed data includes `StudexHub v1`, which is historical project data rather than an application integration.
- The initial `app/layout.tsx` contained the application shell inline; the current working tree moves that code to an untracked `components/app-shell.tsx`.

## 7. Domain & Database Model

The database is SQLite through Prisma.

### `Task`

Schema: `prisma/schema.prisma:10-22`

Fields:

- `id: String`
  - CUID primary key
- `title: String`
- `description: String?`
- `status: String`
  - Default `todo`
- `priority: String`
  - Default `medium`
- `startDate: DateTime?`
- `dueDate: DateTime?`
- `createdAt: DateTime`
  - Default `now()`
- `updatedAt: DateTime`
  - Prisma `@updatedAt`

Relations:

- Many-to-many with `Tag`
- One-to-many relationship from `Note`

Application statuses:

- `todo`
- `doing`
- `done`
- `cancelled`

Consumed by:

- Tasks route
- Dashboard
- Notes links
- Timeline
- Calendar

Completion semantics:

- `done` and `cancelled` are treated as closed in task overdue logic.
- No completion timestamp exists.
- No completed-at field exists.

### `Assignment`

Schema: `prisma/schema.prisma:24-39`

Fields:

- `id: String`
- `courseCode: String`
- `courseName: String`
- `title: String`
- `description: String?`
- `type: String`
  - Default `assignment`
- `status: String`
  - Default `not_started`
- `priority: String`
  - Default `medium`
- `startDate: DateTime?`
- `deadline: DateTime`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Relations:

- Many-to-many with `Tag`
- One-to-many relationship from `Note`

Application types:

- `assignment`
- `exercise`
- `lab`
- `quiz`
- `project`
- `revision`
- `other`

Application statuses:

- `not_started`
- `in_progress`
- `submitted`
- `graded`
- `cancelled`

Consumed by:

- Assignments route
- Dashboard
- Notes links
- Timeline
- Calendar

Completion semantics:

- `submitted`, `graded`, and `cancelled` are normally treated as closed.
- Dashboard additionally recognizes `completed`, but that value is not part of the constants or form options.
- Deadline is required in the schema, but the create/update actions substitute the current time if parsing produces null.

### `Project`

Schema: `prisma/schema.prisma:41-61`

Fields:

- `id: String`
- `title: String`
- `description: String?`
- `status: String`
  - Default `planned`
- `type: String`
  - Default `other`
- `priority: String`
  - Default `medium`
- `startDate: DateTime?`
- `targetDate: DateTime?`
- `completedAt: DateTime?`
- `repositoryUrl: String?`
- `localPath: String?`
- `liveUrl: String?`
- `techStack: String?`
- `objective: String?`
- `currentProgress: String?`
- `nextAction: String?`
- `lessonsLearned: String?`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Relations:

- None

Application statuses:

- `planned`
- `developing`
- `active`
- `paused`
- `completed`
- `archived`
- `abandoned`

Application types:

- `software`
- `infrastructure`
- `networking`
- `cloud`
- `academic`
- `event_ops`
- `lab`
- `documentation`
- `other`

Consumed by:

- Projects route
- Dashboard
- Timeline
- Calendar

Conceptual role:

- A project is a manually maintained memory/control record, not a task container.
- There are no project-task or project-assignment relationships.
- `nextAction` is a text field rather than a related actionable entity.
- `currentProgress` is free text.
- Activity is inferred primarily from `updatedAt`.

### `Note`

Schema: `prisma/schema.prisma:63-74`

Fields:

- `id: String`
- `title: String`
- `body: String`
- `linkedTaskId: String?`
- `linkedAssignmentId: String?`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Relations:

- Optional many-to-one to `Task`
- Optional many-to-one to `Assignment`
- Many-to-many with `Tag`

Delete behavior:

- Linked task deletion sets `linkedTaskId` to null.
- Linked assignment deletion sets `linkedAssignmentId` to null.

Conceptual role:

- A note may link to one task and one assignment simultaneously.
- Notes cannot directly link to projects.
- Notes do not have an explicit category or note type.

### `Tag`

Schema: `prisma/schema.prisma:76-85`

Fields:

- `id: String`
- `name: String`
  - Unique
- `color: String?`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Relations:

- Many-to-many with tasks
- Many-to-many with assignments
- Many-to-many with notes

Constraints/indexes:

- Unique tag name
- Composite uniqueness and reverse indexes on join tables

Conceptual role:

- Reusable cross-entity labels.

Actual current behavior:

- Seeded and persisted.
- Not managed by the application UI.
- Not queried by active page flows.

### Relationship model

Current explicit relationships:

- Notes → optional Task
- Notes → optional Assignment
- Tasks ↔ Tags
- Assignments ↔ Tags
- Notes ↔ Tags

Current absent relationships:

- Projects ↔ Tasks
- Projects ↔ Assignments
- Projects ↔ Notes
- Task dependencies
- Assignment dependencies
- Project milestones
- Recurring records
- Activity history

### Schema constraints

The schema has:

- Primary keys on all models
- Unique tag names
- Required scalar fields
- Optional date fields
- Foreign keys for note links
- Cascade deletion for many-to-many join rows
- `SetNull` deletion behavior for note-to-task and note-to-assignment links

There are no database-level enums for statuses, types, or priorities. These are plain strings.

## 8. Server Actions / Backend Operations

All Server Actions are in `app/actions.ts`.

### Shared parsing helpers

#### `text`

- Reads a form field
- Converts to string
- Trims whitespace
- Returns empty string if absent

#### `optionalText`

- Uses `text`
- Converts empty string to `null`

#### `requiredOption`

- Reads and trims a string
- Checks membership in an allowed constant array
- Throws on invalid values

#### `optionalExistingTaskId`

- Reads optional task ID
- Checks existence with `prisma.task.count`
- Throws if missing
- Returns ID or null

#### `optionalExistingAssignmentId`

- Same behavior for assignments

### Task actions

#### `createTask`

- Input:
  - title
  - description
  - status
  - priority
  - startDate
  - dueDate
- Validation:
  - status and priority enum-like checks
  - date format parsing
- Database:
  - `prisma.task.create`
- Side effects:
  - Revalidates `/tasks`
  - Revalidates `/`
- Output:
  - No explicit return

#### `updateTask`

- Input: same fields plus `id`
- Database:
  - `prisma.task.update`
- Side effects:
  - Revalidates `/tasks`
  - Redirects to `/tasks`
- Error behavior:
  - Prisma errors propagate

#### `deleteTask`

- Deletes by ID
- Revalidates `/tasks` and `/`

### Assignment actions

#### `createAssignment`

- Input:
  - courseCode
  - courseName
  - title
  - description
  - type
  - status
  - priority
  - startDate
  - deadline
- Database:
  - `prisma.assignment.create`
- Notable behavior:
  - Missing parsed deadline becomes `new Date()`
- Side effects:
  - Revalidates `/assignments` and `/`

#### `updateAssignment`

- Updates all assignment fields
- Revalidates `/assignments`
- Redirects to `/assignments`

#### `deleteAssignment`

- Deletes by ID
- Revalidates `/assignments` and `/`

### Project actions

#### `createProject`

- Writes all project fields
- Validates status, type, and priority
- Parses optional dates
- Revalidates:
  - `/projects`
  - `/`
  - `/timeline`
  - `/calendar`

#### `updateProject`

- Updates all project fields
- Revalidates the same four paths
- Redirects to `/projects`

#### `deleteProject`

- Deletes by ID
- Revalidates the same four paths

### Note actions

#### `createNote`

- Validates optional linked task and assignment IDs
- Creates title, body, and links
- Revalidates `/notes` and `/`

#### `updateNote`

- Validates optional linked IDs
- Updates title, body, and links
- Revalidates `/notes`
- Redirects to `/notes`

#### `deleteNote`

- Deletes by ID
- Revalidates `/notes` and `/`

### Transactions

No explicit Prisma transactions are used.

The note create/update linked-record existence checks and note mutation are separate operations. There is no transaction wrapping validation and write.

### Error behavior

- Actions throw ordinary `Error` objects for invalid enum values, invalid dates, and invalid linked IDs.
- Prisma errors are not caught.
- No structured action error result exists.
- No user-facing action error display is present.

## 9. Major Data Flows

### Creation flow

Example: task creation

1. `app/tasks/page.tsx` renders a native HTML form.
2. The form’s `action` references `createTask`.
3. Next.js invokes the Server Action with `FormData`.
4. `app/actions.ts` extracts text values.
5. Status and priority are checked against constants.
6. Dates are parsed by `parseOptionalDate`.
7. Prisma creates the row.
8. `/tasks` and `/` are revalidated.
9. The page is refreshed through the Server Action/navigation behavior.

The same pattern is used for assignments, projects, and notes.

### Editing flow

1. A list item links to `/<entity>?edit=<id>`.
2. The route reads `searchParams`.
3. It performs a `findUnique` query for that ID.
4. The page renders the same form in edit mode.
5. A hidden `id` field is submitted.
6. The corresponding update Server Action writes by ID.
7. The route is revalidated.
8. Update actions redirect to the listing route.

The `key={editing?.id ?? "new-..."}` on forms forces the form subtree to remount when the selected record changes, preserving current saved select values after navigation.

### Completion/status transitions

There are no dedicated transition actions.

A status change is simply an update of the string field through the full edit form.

Task behavior:

- `done` and `cancelled` suppress overdue indicators.
- No completion timestamp is recorded.

Assignment behavior:

- `submitted`, `graded`, and `cancelled` suppress overdue indicators in most views.
- Dashboard also treats `completed` as closed.
- No transition history or completion timestamp is recorded.

Project behavior:

- Status and `completedAt` are independent fields.
- Selecting `completed` does not automatically populate `completedAt`.
- Entering `completedAt` does not automatically change status.

### Dashboard flow

The dashboard performs twelve parallel queries in `Promise.all`.

Metrics are database counts:

- Open tasks
- Completed tasks
- Assignments due this week
- Overdue assignments

The “Overdue items” statistic is an application-side sum:

- `overdueTasks.length`
- plus `overdueAssignments`

Projects are loaded through helper queries and then filtered in application memory.

Recent notes use `updatedAt` ordering and `take: 5`.

### Deletion flow

Tasks, assignments, projects, and notes are hard-deleted with `prisma.*.delete`.

Effects:

- Task/assignment deletion sets linked note foreign keys to null because of `onDelete: SetNull`.
- Tag join rows are configured to cascade, but tags are not currently deleted through the application.
- Projects have no relations, so project deletion affects only the project row.
- There is no confirmation dialog or browser confirmation handler in the inspected code.
- There is no soft deletion or undo.

### Tags/relationships flow

Current active UI relationship flow exists only for notes:

1. Notes page loads all tasks and assignments.
2. User selects at most one task and one assignment.
3. Server Action verifies both IDs exist.
4. Note stores the foreign keys.
5. Deleting the linked record sets the note link to null.

Tag relationships are only exercised by `prisma/seed.ts`. There is no active tag association flow.

### Timeline flow

1. Read URL parameters.
2. Determine selected month and range.
3. Query entities based on type filter.
4. Normalize all entities into one in-memory item shape.
5. Apply status filtering.
6. Calculate visible start/end dates.
7. Calculate ticks, bar offsets, clipping, and overdue display.
8. Render grouped horizontal rows.

### Calendar flow

1. Read selected month.
2. Build a 42-day grid.
3. Query all relevant event sources within the grid range.
4. Normalize records into event objects.
5. Match event dates to calendar cell dates.
6. Render links and overdue styling.

## 10. Validation & Business Rules

### Explicitly enforced by code

- Status, type, and priority values must be in the defined constant arrays when submitted through Server Actions.
- Linked task IDs must exist when supplied to note actions.
- Linked assignment IDs must exist when supplied to note actions.
- Date fields must match `YYYY-MM-DD` format.
- Tag names are unique at the database level.
- Note foreign keys use `SetNull` on linked-record deletion.
- Required HTML fields are marked with `required` in forms.
- External URL fields on project forms use HTML `type="url"`.

### Enforced by the database

- Required scalar fields:
  - Task title
  - Assignment course code, course name, title, deadline
  - Project title
  - Note title and body
- Unique tag names
- Primary keys
- Foreign-key relationships for note links
- Many-to-many join uniqueness
- Timestamp defaults and Prisma-managed update timestamps

### Suggested by UI but not strongly enforced server-side

- Task title should be non-empty
- Assignment course code, course name, and title should be non-empty
- Project title should be non-empty
- Note title/body should be non-empty
- Project URLs should be valid URLs
- Date relationships should make semantic sense
- A completed project should have `completedAt`
- An assignment should always have a meaningful deadline
- Delete operations should be intentional

### Apparently assumed but not enforced

- Start date should be before due date/deadline/target date.
- Target date should be after start date.
- `completedAt` should be after `startDate`.
- Project status should correspond to date fields.
- A task or assignment should not be assigned contradictory statuses and dates.
- Assignment status values should be globally consistent across all views.
- Only valid status strings exist in the database.
- IDs passed to update/delete actions refer to expected records.
- A task cannot be linked to an assignment through other means.
- Projects are not expected to be deleted while referenced, because nothing references them.

### Date semantics

- Date-only form values are parsed using local `new Date(year, month, day)`.
- Display uses `Intl.DateTimeFormat("en-MY")`.
- Date input values use local calendar components.
- Overdue checks normalize compared dates to local midnight.
- The implementation intentionally avoids treating date-only strings as UTC dates.
- `parseOptionalDate` validates format but does not validate actual calendar correctness beyond JavaScript `Date` construction. Invalid calendar combinations may normalize.

## 11. Rendering & State Architecture

### Server Components

All route pages are Server Components by default.

They own:

- Database queries
- Search parameter interpretation
- Filtering
- Sorting
- Derived display calculations
- Forms and form action bindings
- Most feature rendering

### Client Components

Client components are limited to:

- `AppShell`
- `ThemeProvider`
- `ThemeToggle`

Reasons for client usage:

- Sidebar local state and localStorage
- Theme local state, browser APIs, and event handlers

### Server Actions

Server Actions are used for all mutations.

There are no API routes or client-side fetch calls.

### Local React state

Application state in the browser is minimal:

- Sidebar open/closed
- Theme

Entity state remains in the database and is reloaded by Server Components.

### URL state

URL search parameters control:

- Tasks:
  - `status`
  - `priority`
  - `edit`
- Assignments:
  - `course`
  - `type`
  - `status`
  - `priority`
  - `edit`
- Projects:
  - `status`
  - `type`
  - `priority`
  - `sort`
  - `edit`
- Notes:
  - `q`
  - `edit`
- Timeline:
  - `month`
  - `type`
  - `status`
  - `range`
- Calendar:
  - `month`

### Revalidation/navigation

Create/delete actions generally revalidate the listing and dashboard.

Project mutations also revalidate timeline and calendar because project dates affect those routes.

Update actions generally revalidate and redirect back to the feature page.

There is no shared post-mutation policy abstraction.

### Dynamic rendering

- Dashboard exports `dynamic = "force-dynamic"`.
- Calendar exports `dynamic = "force-dynamic"`.
- Other routes rely on their database usage and Next.js runtime behavior rather than explicit dynamic configuration.

No `loading.tsx` or `error.tsx` files were found.

## 12. UI / Design Architecture

### Styling

- Tailwind CSS 3
- CSS custom properties for theme colors
- Class-based dark mode
- `tailwind-merge` and `clsx` through `cn`

### Design tokens

Defined in `app/globals.css`:

- Background
- Foreground
- Card
- Primary
- Secondary
- Muted
- Accent
- Destructive
- Border
- Input
- Ring
- Radius

Separate light and dark CSS variable values exist.

### Typography and spacing

- Default Tailwind typography utilities
- Page titles generally use `text-2xl font-semibold`
- Cards use shared padding and rounded borders
- Layout spacing is primarily `gap-*`, `p-*`, `mb-*`, and `space-y-*`

### Layout

- Desktop:
  - Sidebar plus main content grid
- Mobile/tablet:
  - Horizontal navigation
  - Main content remains a single column
- Sidebar:
  - 240px expanded
  - 64px collapsed on large screens
  - Sidebar state persists locally

### Components

Reusable primitives:

- Button
- Card
- Badge
- Input
- Select
- Textarea
- PageHeader
- EmptyState

Feature-specific presentation remains inside route files.

### Status indicators

- Status and type values are displayed through badges.
- Priority uses `priorityClass`.
- Overdue records use red borders/badges/text.
- Timeline uses red bars for overdue items and teal bars for normal items.
- Calendar uses red event styling for overdue events and teal styling otherwise.

### Icons

`lucide-react` is used for:

- Navigation icons
- Sidebar controls
- Theme controls
- External links
- Timeline continuation arrows

### Responsive behavior

- Main lists and forms use breakpoint-based grid layouts.
- Project, task, and assignment forms use wider desktop columns.
- Timeline deliberately uses a minimum width and horizontal scrolling.
- Calendar uses a seven-column grid with fixed minimum cell heights.
- Sidebar navigation becomes horizontally scrollable on smaller screens.

### Theme support

- Light and dark themes supported.
- Preference stored in localStorage.
- System preference used when no saved theme exists.
- Root layout includes an inline script to apply the theme before hydration.

## 13. Operational Architecture

### Package manager

- npm
- `package-lock.json` is committed

### Development

- `npm run dev`
- Default Next.js development server, normally port 3000

### Build and production

- `npm run build`
- `npm start`

### Environment

`.env.example` defines:

```text
DATABASE_URL="file:../data/personalhub.db"
```

The path is intended to be resolved relative to the Prisma schema location.

### Prisma

Available scripts:

- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:seed`

Docker startup uses:

```text
npx prisma migrate deploy
```

The container does not seed data.

### SQLite

- Host path: `./data/personalhub.db`
- Ignored by Git
- Docker bind mount: `./data:/app/data`
- Container environment uses `file:../data/personalhub.db`

### Docker

Build stages:

1. Dependency installation
2. Prisma generation and Next.js build
3. Production runner

Runtime:

- Node 22 slim
- Port 3000 inside container
- Host port 3001
- Restart policy `unless-stopped`
- Persistent host-mounted database directory

### Backup

`scripts/backup-db.sh`:

- Requires the current database to exist
- Creates `backups/` if needed
- Copies the database to a timestamped filename

### Restore

`scripts/restore-db.sh`:

- Requires exactly one source path
- Validates source existence
- Requires typed `YES`
- Creates a safety backup of the current database
- Replaces `data/personalhub.db`

The README correctly warns that the application should be stopped before restore if it may be writing.

### Seed behavior

`prisma/seed.ts` deletes:

- Notes
- Projects
- Tasks
- Assignments
- Tags

Then recreates demo data.

This is destructive and should not be run against a valuable database.

### Migration history

1. Initial schema:
   - Tasks
   - Assignments
   - Notes
   - Tags
   - Tag join tables
   - Assignment `weight` and `marks`

2. Assignment change:
   - Adds `type`
   - Removes `weight` and `marks`
   - Uses table redefinition in SQLite

3. Project addition:
   - Adds the standalone `Project` model

### Data-loss considerations

High-risk operations:

- Running the seed script against real data
- Restoring the wrong backup
- Applying schema changes that redefine SQLite tables
- Removing or renaming fields during redesign
- Dropping or altering tag join tables
- Changing note foreign-key delete behavior
- Running Docker against a different `DATABASE_URL`
- Migrating existing date/status strings without preserving data

## 14. Dependencies

### Framework/runtime

- `next`
  - App Router, Server Components, Server Actions, routing, rendering
- `react`
- `react-dom`

### Database

- `@prisma/client`
  - Runtime database client
- `prisma`
  - CLI, migrations, generation, seed integration

### UI

- `lucide-react`
  - Icons
- `@radix-ui/react-slot`
  - `Button asChild`
- `class-variance-authority`
  - Button variants
- `clsx`
  - Conditional class handling
- `tailwind-merge`
  - Tailwind class conflict resolution

### Build/style

- `tailwindcss`
- `postcss`
- `autoprefixer`

### Development/tooling

- `typescript`
- `eslint`
- `eslint-config-next`
- `prettier`
- `tsx`
- `@types/node`
- `@types/react`
- `@types/react-dom`

No testing framework or testing library is present.

No obvious unused major runtime dependency was found. Some primitive exports, such as `CardDescription`, appear unused in the current route code, but the package itself is used through the shared UI components.

## 15. Error Handling & Resilience

### Server-side errors

Errors are generally allowed to propagate:

- Invalid enum values throw `Error`
- Invalid date strings throw `Error`
- Invalid linked IDs throw `Error`
- Missing records or invalid update/delete IDs produce Prisma errors
- Database failures are not caught

There is no standardized error object or form error response.

### UI error states

No route-level `error.tsx` files were found.

No action error display is implemented.

No toast or inline mutation error system exists.

### Loading states

No route-level `loading.tsx` files were found.

Pages wait for their database queries before rendering.

### Missing records

- Editing a nonexistent ID results in no edit record, so the page falls back to create mode.
- Update/delete actions with nonexistent IDs will fail through Prisma.
- There is no explicit not-found page for invalid edit IDs.

### Validation weaknesses

- Server-side required text validation is limited.
- Native `required` attributes can be bypassed.
- Date format is checked, but calendar semantics are not fully checked.
- URL validation is primarily browser-side.
- Status strings are not constrained at the database level.
- Assignment deadline fallback can silently produce the current date.

### Destructive actions

- Deletes are hard deletes.
- No confirmation UI was found.
- Restore has explicit confirmation.
- Seed is destructive and has no confirmation inside the script.

### Concurrency/race assumptions

- No transaction boundaries for multi-step validation/write operations.
- Dashboard performs multiple independent reads, so counts and lists can reflect slightly different database moments.
- Backup uses a plain file copy rather than SQLite’s backup API.
- Restore assumes the application is stopped by the operator.
- No locking or multi-user concurrency design exists.

### Database corruption/missing database

- Prisma/Docker migration startup will fail if the database is unavailable or malformed.
- No application-level recovery screen was found.
- Backup/restore scripts provide operational recovery but no integrity check beyond file existence.

## 16. Dead Code / Historical Residue

### Tags

Tags are the clearest incomplete subsystem:

- Present in Prisma schema
- Present in initial migration
- Seeded in `prisma/seed.ts`
- No UI or actions
- No active feature queries use them

They should be treated as existing persisted data during any redesign.

### Removed assignment grading fields

The initial migration created:

- `weight`
- `marks`

The second migration removed them. The current schema, actions, forms, and documentation intentionally omit them.

Any database migration must account for historical databases that may have passed through this change.

### StudexHub

`StudexHub v1` is seed content in the project list. It is not a code integration or separate feature.

### Inline-to-shared shell transition

The current worktree has:

- `app/layout.tsx` modified to import `AppShell`
- `components/app-shell.tsx` untracked

The previous committed architecture had the shell inline inside `app/layout.tsx`.

This is an uncommitted workspace change and should be preserved or deliberately reconciled before implementation work.

### Documentation drift

Documentation describes tags as an MVP data-model feature, but the active application does not expose them.

The product documentation also describes the intended scope accurately in most other areas.

### No abandoned routes or API routes

No route handlers, API endpoints, commented-out feature implementations, or explicit TODO/FIXME markers were found in project source.

## 17. Feature Dependency Map

```text
Application Shell
├─ Root layout
├─ ThemeProvider
├─ ThemeToggle
├─ Navigation
└─ All routes

Dashboard
├─ Tasks
├─ Assignments
├─ Projects
├─ Notes
├─ lib/projects.ts
└─ lib/utils.ts

Tasks
├─ Task model
├─ createTask/updateTask/deleteTask
├─ taskStatuses
├─ priorities
└─ date/overdue utilities

Assignments
├─ Assignment model
├─ createAssignment/updateAssignment/deleteAssignment
├─ assignmentStatuses
├─ assignmentTypes
├─ priorities
└─ date/overdue utilities

Projects
├─ Project model
├─ createProject/updateProject/deleteProject
├─ lib/projects.ts
├─ projectStatuses
├─ projectTypes
├─ priorities
└─ Dashboard/Timeline/Calendar integrations

Notes
├─ Note model
├─ Task model for optional link
├─ Assignment model for optional link
├─ createNote/updateNote/deleteNote
└─ title/body search

Timeline
├─ Task due dates
├─ Assignment deadlines
├─ Project start/target/completed dates
├─ lib/projects.ts
└─ URL filters/range state

Calendar
├─ Task due dates
├─ Assignment deadlines
├─ Project target dates
├─ Project completed dates
└─ URL month state

Tags
├─ Tag model
├─ TaskTags join table
├─ AssignmentTags join table
├─ NoteTags join table
└─ Seed data only in active behavior

Operations
├─ Prisma migrations
├─ SQLite database
├─ Docker Compose
├─ Backup script
├─ Restore script
└─ Seed script
```

Entity relationship map:

```text
Task
├─ Notes: one-to-many
└─ Tags: many-to-many

Assignment
├─ Notes: one-to-many
└─ Tags: many-to-many

Note
├─ Optional Task
├─ Optional Assignment
└─ Tags: many-to-many

Project
└─ No database relationships

Tag
├─ Tasks
├─ Assignments
└─ Notes
```

## 18. Redesign Risk Map

### High-risk

#### SQLite schema and migrations

Files:

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `data/personalhub.db`

Risk:

- Existing data must survive schema changes.
- SQLite table redefinition is already used.
- Migration deployment is part of Docker startup.

#### Status and type strings

Files:

- `lib/constants.ts`
- `app/actions.ts`
- Dashboard, timeline, calendar, and feature pages

Risk:

- Status values are plain strings.
- Different views contain their own closed-status lists.
- Renaming values can silently break filtering, overdue logic, and existing records.

#### Date fields and date-only semantics

Files:

- `lib/utils.ts`
- All CRUD actions
- Dashboard
- Timeline
- Calendar

Risk:

- Date-only values use local calendar construction.
- Timeline and calendar use date boundaries independently.
- Changing date parsing can shift existing deadlines.

#### Note foreign-key relationships

Files:

- `prisma/schema.prisma`
- Initial migration
- `app/actions.ts`
- `app/notes/page.tsx`

Risk:

- Existing notes may rely on `SetNull` deletion behavior.
- Redesigning domain relationships could orphan or misassociate notes.

#### Tag persistence

Files:

- `prisma/schema.prisma`
- Initial migration
- `prisma/seed.ts`

Risk:

- Tags are currently hidden from the UI but may exist in user data.
- Removing them would discard existing relationships.

#### Docker database path and volume

Files:

- `docker-compose.yml`
- `Dockerfile`
- `.env.example`
- `docker-entrypoint.sh`

Risk:

- Incorrect path or volume changes can point the application at a new empty database or lose persistence.

#### Seed and restore scripts

Files:

- `prisma/seed.ts`
- `scripts/restore-db.sh`

Risk:

- Seed deletes all domain data.
- Restore replaces the live database after confirmation.

### Medium-risk

#### Server Action contracts

File:

- `app/actions.ts`

Risk:

- Forms depend on field names and hidden IDs.
- Replacing actions requires preserving form payload semantics or migrating every caller.

#### Revalidation behavior

File:

- `app/actions.ts`

Risk:

- Project mutations explicitly refresh dashboard, timeline, and calendar.
- Removing one revalidation path can leave stale derived views.

#### Dashboard derived behavior

File:

- `app/page.tsx`

Risk:

- Dashboard contains duplicated status rules and project filtering.
- Changes to entity semantics affect counts and summaries.

#### Timeline and calendar normalization

Files:

- `app/timeline/page.tsx`
- `app/calendar/page.tsx`

Risk:

- These views derive their own normalized event models and date logic.
- Changes to dates or statuses require coordinated updates.

#### Route query parameters

Files:

- All listing pages

Risk:

- URLs are used as state for filters and edit selection.
- Changing names or semantics affects links from the dashboard and cross-feature navigation.

#### Current uncommitted shell extraction

Files:

- `app/layout.tsx`
- `components/app-shell.tsx`

Risk:

- The current working tree does not match the latest commit.
- Later work must avoid accidentally discarding the user’s uncommitted shell change.

### Low-risk

#### Isolated visual primitives

Files:

- `components/ui/*`
- `components/page-header.tsx`
- `components/empty-state.tsx`

Risk:

- Mostly presentation-level changes unless their props or form behavior are changed.

#### Theme and sidebar persistence

Files:

- `components/theme-provider.tsx`
- `components/theme-toggle.tsx`
- `components/app-shell.tsx`

Risk:

- Mostly browser-local state and visual behavior.

#### Static Settings/About content

File:

- `app/settings/page.tsx`

Risk:

- No persistence or cross-feature dependencies.

## 19. Initial Architectural Observations

These are observations only, not a redesign plan.

### Architectural friction

- Route files are responsible for querying, filtering, mutation form composition, item rendering, and feature-specific business display logic.
- Server Actions mix parsing, validation, persistence, and cache invalidation.
- Status semantics are repeated in dashboard, task, assignment, timeline, and calendar code.
- Project queries have a helper module, but equivalent query boundaries do not exist for tasks, assignments, or notes.

### Inconsistent patterns

- Projects use `lib/projects.ts`; other entities query Prisma directly inside pages.
- Some pages explicitly force dynamic rendering while others do not.
- Create actions revalidate without redirecting; update actions generally redirect.
- Dashboard and feature pages maintain separate definitions of closed assignment statuses.
- Some actions validate related IDs, while direct entity IDs for update/delete are left to Prisma.

### Duplicated concepts

- Status normalization is repeated through `statusLabel`.
- Overdue logic is repeated for tasks, assignments, and projects.
- Date-range calculations are independently implemented in timeline and calendar.
- Create/edit forms are duplicated per entity.
- Delete form markup is repeated across entity pages.
- Project display and project dashboard summary each implement separate selection/filtering logic.

### Domain ambiguity

- `nextAction` is a free-text project field rather than a task or relation.
- `currentProgress` is free text with no history or measurable structure.
- `completedAt` and project status can contradict each other.
- Assignment status contains no `completed` option, but dashboard logic recognizes it.
- Tags are structurally part of the model but operationally absent.
- Notes can link to tasks and assignments but not projects.

### Abstraction boundaries

- The local UI primitives are lightweight and appropriately isolated.
- The domain/query layer is thin.
- The application currently relies more on page-level composition than reusable feature modules.
- `lib/projects.ts` suggests an emerging query-helper pattern that has not been generalized.

### Operational observations

- The local-first model is clear and coherent.
- File-copy backups are simple but do not provide SQLite-consistent snapshot semantics during active writes.
- Restore is operator-protected but depends on the operator stopping the application.
- There is no automated migration or backup verification workflow.

## 20. Unknowns / Things That Could Not Be Proven

The following were not proven through source inspection alone:

- Whether all manual acceptance tests currently pass in a live browser.
- Whether Docker builds and starts successfully in the current environment.
- Whether the current uncommitted `AppShell` extraction has been manually verified.
- Whether the SQLite database contains data not visible through the simple model counts.
- Whether any users rely on existing tag relationships.
- Whether historical databases contain records with removed assignment fields.
- Whether deployment outside the documented localhost/Docker setup exists.
- Whether the `completed` assignment status exists in real user data.
- Whether backup copies are taken while Docker or npm development mode is active.
- Whether generated Prisma client state matches the current schema without regeneration.
- Whether browser-specific date behavior is consistent across all target environments.
- Whether the application is intended to support LAN access despite documentation describing localhost use.

The repository contains no automated tests, so behavior beyond static code paths was not asserted.

## 21. Repository Map for the Next Model

Most important files and directories:

- `app/layout.tsx`
  - Root document, theme bootstrap, global shell integration

- `components/app-shell.tsx`
  - Current uncommitted global navigation/sidebar implementation

- `app/page.tsx`
  - Dashboard queries and cross-domain derived behavior

- `app/actions.ts`
  - All mutations, field names, validation, Prisma writes, redirects, and revalidation

- `app/tasks/page.tsx`
  - Task UI, filters, edit flow, and task-specific overdue behavior

- `app/assignments/page.tsx`
  - Assignment UI, course/type/status filters, and assignment-specific deadline behavior

- `app/projects/page.tsx`
  - Project UI, project fields, filters, sorting, links, and lifecycle data

- `app/notes/page.tsx`
  - Notes, text search, and task/assignment relationships

- `app/timeline/page.tsx`
  - Cross-entity date normalization and horizontal timeline calculations

- `app/calendar/page.tsx`
  - Cross-entity calendar event normalization and month navigation

- `lib/constants.ts`
  - Current allowed statuses, types, and priorities

- `lib/utils.ts`
  - Date parsing, date display, overdue rules, status labels, and shared styling logic

- `lib/projects.ts`
  - Project query boundary and dashboard/timeline/calendar project lookups

- `prisma/schema.prisma`
  - Authoritative current persistence model

- `prisma/migrations/`
  - Required migration history and historical field changes

- `prisma/seed.ts`
  - Destructive demo-data initialization; do not run against valuable data

- `data/personalhub.db`
  - Current local persistence file, ignored by Git

- `Dockerfile`
- `docker-compose.yml`
- `docker-entrypoint.sh`
  - Production-mode local deployment and persistence behavior

- `scripts/backup-db.sh`
- `scripts/restore-db.sh`
  - Database recovery operations

Before making changes, the implementation model must understand:

1. Existing SQLite data and migration history.
2. The current uncommitted layout/AppShell change.
3. The Server Action form field contracts in `app/actions.ts`.
4. Status strings and their duplicated closed/overdue rules.
5. Date-only parsing and local-time behavior.
6. Note foreign-key `SetNull` semantics.
7. Hidden-but-persisted tag data.
8. Project dependencies on dashboard, timeline, and calendar revalidation.
9. The destructive nature of the seed and restore workflows.
10. The difference between documented structural features and features actually exposed end-to-end.
