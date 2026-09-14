import Link from "next/link";
import { QuickCapture } from "@/components/quick-capture";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  dashboardData,
  STALE_PROJECT_AGE_DAYS
} from "@/features/dashboard/service";
import { formatDate, priorityClass, statusLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboard = await dashboardData();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A calm, actionable view of what needs your attention."
      />
      <section className="mb-6">
        <QuickCapture />
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <PlanningCard
          title="Today"
          empty="Nothing dated for today."
          items={dashboard.today}
        />
        <PlanningCard
          title="Overdue"
          empty="Nothing overdue."
          items={dashboard.overdue}
          overdue
        />
        <PlanningCard
          title="Coming soon"
          empty="No open dates in the next seven days."
          items={dashboard.comingSoon}
        />
        <SimpleCard
          title="Recent completions"
          empty="Completed items appear here only when they have a recorded completion timestamp."
        >
          {dashboard.recentCompleted.map((entry) => (
            <Link
              key={`${entry.entity}-${entry.id}`}
              href={entry.href}
              className="block rounded-md border p-3 hover:bg-muted"
            >
              <p className="font-medium">{entry.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.entity} · completed {formatDate(entry.completedAt)}
              </p>
            </Link>
          ))}
        </SimpleCard>
        <SimpleCard
          title="Projects needing a next step"
          empty="Every open project either has a next action or linked open task."
        >
          {dashboard.projectsNeedingSteps.map((project) => (
            <ProjectLink
              key={project.id}
              project={project}
              detail="No next action or open linked task."
            />
          ))}
        </SimpleCard>
        <SimpleCard
          title="Stale or paused projects"
          empty="No paused or stale open projects."
        >
          <p className="-mt-2 text-xs text-muted-foreground">
            Stale means no update for {STALE_PROJECT_AGE_DAYS} days; paused
            projects are always shown.
          </p>
          {dashboard.staleOrPausedProjects.map((project) => (
            <ProjectLink
              key={project.id}
              project={project}
              detail={`Updated ${formatDate(project.updatedAt)}`}
            />
          ))}
        </SimpleCard>
        <SimpleCard title="Recent notes" empty="No notes yet.">
          {dashboard.recentNotes.map((note) => (
            <Link
              key={note.id}
              href={`/notes?edit=${note.id}`}
              className="block rounded-md border p-3 hover:bg-muted"
            >
              <p className="font-medium">{note.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {note.body}
              </p>
            </Link>
          ))}
        </SimpleCard>
      </section>
    </>
  );
}

function PlanningCard({
  title,
  empty,
  items,
  overdue = false
}: {
  title: string;
  empty: string;
  items: Awaited<ReturnType<typeof dashboardData>>["today"];
  overdue?: boolean;
}) {
  return (
    <SimpleCard title={title} empty={empty}>
      {items.map((entry) => (
        <Link
          key={`${entry.entity}-${entry.id}`}
          href={entry.href}
          className={`block rounded-md border p-3 hover:bg-muted ${overdue ? "border-red-200 dark:border-red-900" : ""}`}
        >
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-medium">{entry.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.group} ·{" "}
                {entry.event === "deadline"
                  ? "Deadline"
                  : entry.event === "target"
                    ? "Target"
                    : "Due"}{" "}
                {formatDate(entry.date)}
              </p>
            </div>
            <div className="flex h-fit flex-wrap justify-end gap-1">
              <Badge>{statusLabel(entry.status)}</Badge>
              <Badge className={priorityClass(entry.priority)}>
                {entry.priority}
              </Badge>
            </div>
          </div>
        </Link>
      ))}
    </SimpleCard>
  );
}

function SimpleCard({
  title,
  empty,
  children
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? children : <EmptyState title={title} message={empty} />}
      </CardContent>
    </Card>
  );
}

function ProjectLink({
  project,
  detail
}: {
  project: { id: string; title: string; status: string; priority: string };
  detail: string;
}) {
  return (
    <Link
      href={`/projects?edit=${project.id}`}
      className="block rounded-md border p-3 hover:bg-muted"
    >
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-medium">{project.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className="flex h-fit gap-1">
          <Badge>{statusLabel(project.status)}</Badge>
          <Badge className={priorityClass(project.priority)}>
            {project.priority}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
