import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { createProject, deleteProject, updateProject } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { priorities, projectStatuses, projectTypes } from "@/lib/constants";
import { findProjectById, findProjects, type Project } from "@/lib/projects";
import { dateInputValue, formatDate, priorityClass, statusLabel } from "@/lib/utils";

const sortOptions = ["recently_updated", "start_date", "target_date", "title"] as const;

function projectHref(project: Project) {
  return `/projects?edit=${project.id}`;
}

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; type?: string; priority?: string; sort?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const [projects, editing] = await Promise.all([
    findProjects({ status: params.status, type: params.type, priority: params.priority, sort: params.sort }),
    params.edit ? findProjectById(params.edit) : null
  ]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Private memory and control panel for personal, technical, academic, operations, and lab projects."
      />
      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <ProjectForm key={editing?.id ?? "new-project"} mode={editing ? "Edit project" : "Create project"} project={editing} />
        <section>
          <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-5">
            <Select name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {projectStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </Select>
            <Select name="type" defaultValue={params.type ?? ""}>
              <option value="">All types</option>
              {projectTypes.map((type) => (
                <option key={type} value={type}>{statusLabel(type)}</option>
              ))}
            </Select>
            <Select name="priority" defaultValue={params.priority ?? ""}>
              <option value="">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </Select>
            <Select name="sort" defaultValue={params.sort ?? "recently_updated"}>
              {sortOptions.map((sort) => (
                <option key={sort} value={sort}>{statusLabel(sort)}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>

          {projects.length === 0 ? (
            <EmptyState title="No projects found" message="Create a project or clear your filters." />
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={projectHref(project)} className="text-base font-medium hover:underline">
              {project.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">{project.description || "No description"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{statusLabel(project.status)}</Badge>
            <Badge>{statusLabel(project.type)}</Badge>
            <Badge className={priorityClass(project.priority)}>{project.priority}</Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <Detail label="Tech stack" value={project.techStack} />
          <Detail label="Current progress" value={project.currentProgress} />
          <Detail label="Next action" value={project.nextAction} />
          <Detail label="Objective" value={project.objective} />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {project.repositoryUrl ? <ProjectLink href={project.repositoryUrl} label="Repository" /> : null}
          {project.liveUrl ? <ProjectLink href={project.liveUrl} label="Live link" /> : null}
          {project.localPath ? <span className="break-all">Local: {project.localPath}</span> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Start {formatDate(project.startDate)}</span>
          <span>Target {formatDate(project.targetDate)}</span>
          <span>Completed {formatDate(project.completedAt)}</span>
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>

        {project.lessonsLearned ? (
          <p className="mt-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Lessons learned: </span>
            {project.lessonsLearned}
          </p>
        ) : null}

        <form action={deleteProject} className="mt-3">
          <input type="hidden" name="id" value={project.id} />
          <Button type="submit" variant="destructive" size="sm">Delete</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline dark:text-teal-300">
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-muted-foreground">{value || "Not set"}</p>
    </div>
  );
}

function ProjectForm({
  mode,
  project
}: {
  mode: string;
  project: Project | null;
}) {
  const action = project ? updateProject : createProject;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          {project ? <input type="hidden" name="id" value={project.id} /> : null}
          <Input name="title" placeholder="Project title" defaultValue={project?.title ?? ""} required />
          <Textarea name="description" placeholder="Short description" defaultValue={project?.description ?? ""} />
          <div className="grid grid-cols-3 gap-3">
            <Select name="status" defaultValue={project?.status ?? "planned"}>
              {projectStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </Select>
            <Select name="type" defaultValue={project?.type ?? "other"}>
              {projectTypes.map((type) => (
                <option key={type} value={type}>{statusLabel(type)}</option>
              ))}
            </Select>
            <Select name="priority" defaultValue={project?.priority ?? "medium"}>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium">
              Start date
              <Input className="mt-1" type="date" name="startDate" defaultValue={dateInputValue(project?.startDate)} />
            </label>
            <label className="text-sm font-medium">
              Target date
              <Input className="mt-1" type="date" name="targetDate" defaultValue={dateInputValue(project?.targetDate)} />
            </label>
            <label className="text-sm font-medium">
              Completed at
              <Input className="mt-1" type="date" name="completedAt" defaultValue={dateInputValue(project?.completedAt)} />
            </label>
          </div>
          <Input name="repositoryUrl" type="url" placeholder="Repository URL" defaultValue={project?.repositoryUrl ?? ""} />
          <Input name="localPath" placeholder="Local folder path" defaultValue={project?.localPath ?? ""} />
          <Input name="liveUrl" type="url" placeholder="Live URL" defaultValue={project?.liveUrl ?? ""} />
          <Textarea name="techStack" placeholder="Tech stack" defaultValue={project?.techStack ?? ""} />
          <Textarea name="objective" placeholder="Objective" defaultValue={project?.objective ?? ""} />
          <Textarea name="currentProgress" placeholder="Current progress" defaultValue={project?.currentProgress ?? ""} />
          <Textarea name="nextAction" placeholder="Next action" defaultValue={project?.nextAction ?? ""} />
          <Textarea name="lessonsLearned" placeholder="Lessons learned" defaultValue={project?.lessonsLearned ?? ""} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{project ? "Save project" : "Create project"}</Button>
            {project ? <Button asChild variant="outline"><Link href="/projects">Cancel</Link></Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
