import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { countProjectsByStatus, findProjects } from "@/lib/projects";
import { formatDate, isBeforeToday, priorityClass, statusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

const closedAssignmentStatuses = ["submitted", "graded", "completed", "cancelled"];
const priorityRank: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(today.getDate() + 7);

  const [
    todayTasks,
    overdueTasks,
    upcomingAssignments,
    recentNotes,
    openTasks,
    completedTasks,
    dueThisWeekAssignments,
    overdueAssignments,
    overdueAssignmentItems,
    activeProjects,
    pausedProjectsCount,
    recentProjects,
    nextActionProjects
  ] =
    await Promise.all([
      prisma.task.findMany({
        where: { dueDate: { gte: today, lt: tomorrow }, status: { notIn: ["done", "cancelled"] } },
        orderBy: { dueDate: "asc" }
      }),
      prisma.task.findMany({
        where: { dueDate: { lt: today }, status: { notIn: ["done", "cancelled"] } },
        orderBy: { dueDate: "asc" }
      }),
      prisma.assignment.findMany({
        where: { deadline: { gte: today, lte: inSevenDays }, status: { notIn: ["submitted", "graded", "cancelled"] } },
        orderBy: { deadline: "asc" }
      }),
      prisma.note.findMany({ take: 5, orderBy: { updatedAt: "desc" } }),
      prisma.task.count({ where: { status: { in: ["todo", "doing"] } } }),
      prisma.task.count({ where: { status: "done" } }),
      prisma.assignment.count({
        where: { deadline: { gte: today, lte: inSevenDays }, status: { notIn: ["submitted", "graded", "cancelled"] } }
      }),
      prisma.assignment.count({ where: { deadline: { lt: today }, status: { notIn: closedAssignmentStatuses } } }),
      prisma.assignment.findMany({
        where: { deadline: { lt: today }, status: { notIn: closedAssignmentStatuses } },
        orderBy: { deadline: "asc" }
      }),
      findProjects({ take: 20 }),
      countProjectsByStatus("paused"),
      findProjects({ take: 3 }),
      findProjects({ take: 20 })
    ]);

  const activeProjectItems = activeProjects.filter((project) => ["developing", "active"].includes(project.status)).slice(0, 3);
  const nextActionProjectItems = nextActionProjects
    .filter((project) => project.nextAction && ["planned", "developing", "active", "paused"].includes(project.status))
    .slice(0, 3);
  const topOverdueAssignments = overdueAssignmentItems
    .sort((first, second) => {
      const priorityDifference = (priorityRank[first.priority] ?? 99) - (priorityRank[second.priority] ?? 99);
      if (priorityDifference !== 0) return priorityDifference;
      return first.deadline.getTime() - second.deadline.getTime();
    })
    .slice(0, 5);

  const stats = [
    ["Open tasks", openTasks],
    ["Completed tasks", completedTasks],
    ["Assignments due this week", dueThisWeekAssignments],
    ["Overdue items", overdueTasks.length + overdueAssignments]
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="A quick view of today, overdue work, and upcoming diploma deadlines." />
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <SummaryCard title="Today’s tasks" empty="No tasks due today.">
          {todayTasks.map((task) => (
            <ItemRow key={task.id} href={`/tasks?edit=${task.id}`} title={task.title} meta={formatDate(task.dueDate)} status={task.status} priority={task.priority} />
          ))}
        </SummaryCard>
        <SummaryCard title="Overdue tasks" empty="No overdue tasks.">
          {overdueTasks.map((task) => (
            <ItemRow
              key={task.id}
              href={`/tasks?edit=${task.id}`}
              title={task.title}
              meta={`Due ${formatDate(task.dueDate)}`}
              status={task.status}
              priority={task.priority}
              overdue={isBeforeToday(task.dueDate)}
            />
          ))}
        </SummaryCard>
        <OverdueAssignmentsCard assignments={topOverdueAssignments} today={today} />
        <SummaryCard title="Assignments due within 7 days" empty="No assignments due in the next week.">
          {upcomingAssignments.map((assignment) => (
            <ItemRow
              key={assignment.id}
              href={`/assignments?edit=${assignment.id}`}
              title={`${assignment.courseCode}: ${assignment.title}`}
              meta={`Deadline ${formatDate(assignment.deadline)}`}
              status={assignment.status}
              priority={assignment.priority}
            />
          ))}
        </SummaryCard>
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <p className="text-sm text-muted-foreground">{pausedProjectsCount} paused</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProjectList title="Developing or active" empty="No active projects." projects={activeProjectItems} />
            <ProjectList title="Next actions" empty="No next project actions set." projects={nextActionProjectItems} showNextAction />
            <ProjectList title="Recently updated" empty="No projects yet." projects={recentProjects} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotes.length === 0 ? (
              <EmptyState title="No notes yet" message="Create notes for study summaries, assignment ideas, and reminders." />
            ) : (
              recentNotes.map((note) => (
                <Link key={note.id} href={`/notes?edit=${note.id}`} className="block rounded-md border p-3 hover:bg-muted">
                  <p className="font-medium">{note.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{note.body}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function daysOverdue(deadline: Date, today: Date) {
  const date = new Date(deadline);
  date.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today.getTime() - date.getTime()) / 86_400_000));
}

function OverdueAssignmentsCard({
  assignments,
  today
}: {
  assignments: {
    id: string;
    title: string;
    courseCode: string;
    courseName: string;
    type: string;
    status: string;
    priority: string;
    deadline: Date;
  }[];
  today: Date;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Overdue assignments</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Highest priority first, then oldest deadline.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/assignments">Assignments</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.length === 0 ? (
          <EmptyState title="No overdue assignments." message="Nothing needs attention in this section." />
        ) : (
          assignments.map((assignment) => {
            const overdueDays = daysOverdue(assignment.deadline, today);
            return (
              <Link key={assignment.id} href={`/assignments?edit=${assignment.id}`} className="block rounded-md border bg-card p-3 hover:bg-muted">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{assignment.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {assignment.courseCode}
                      {assignment.courseName ? ` · ${assignment.courseName}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-300">
                      Deadline {formatDate(assignment.deadline)} · {overdueDays} {overdueDays === 1 ? "day" : "days"} overdue
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge>{statusLabel(assignment.type)}</Badge>
                    <Badge>{statusLabel(assignment.status)}</Badge>
                    <Badge className={priorityClass(assignment.priority)}>{assignment.priority}</Badge>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function ProjectList({
  title,
  empty,
  projects,
  showNextAction
}: {
  title: string;
  empty: string;
  projects: { id: string; title: string; status: string; priority: string; nextAction: string | null; updatedAt: Date }[];
  showNextAction?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {projects.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <Link key={`${title}-${project.id}`} href={`/projects?edit=${project.id}`} className="block rounded-md border bg-card p-3 hover:bg-muted">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{project.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {showNextAction && project.nextAction ? project.nextAction : `Updated ${formatDate(project.updatedAt)}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Badge>{statusLabel(project.status)}</Badge>
                  <Badge className={priorityClass(project.priority)}>{project.priority}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {children.length ? children : <EmptyState title={empty} message="Nothing needs attention in this section." />}
      </CardContent>
    </Card>
  );
}

function ItemRow({
  href,
  title,
  meta,
  status,
  priority,
  overdue
}: {
  href: string;
  title: string;
  meta: string;
  status: string;
  priority: string;
  overdue?: boolean;
}) {
  return (
    <Link href={href} className="block rounded-md border bg-card p-3 hover:bg-muted">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className={overdue ? "mt-1 text-sm font-medium text-red-600 dark:text-red-300" : "mt-1 text-sm text-muted-foreground"}>{meta}</p>
        </div>
        <div className="flex gap-1">
          <Badge>{statusLabel(status)}</Badge>
          <Badge className={priorityClass(priority)}>{priority}</Badge>
        </div>
      </div>
    </Link>
  );
}
