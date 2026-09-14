"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { Project } from "@prisma/client";
import {
  createProjectAction,
  type ProjectFormState,
  updateProjectAction
} from "@/features/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { priorities, projectStatuses, projectTypes } from "@/lib/constants";
import { dateInputValue, statusLabel } from "@/lib/utils";
export function ProjectForm({ project }: { project: Project | null }) {
  const [s, a, p] = useActionState(
    project ? updateProjectAction : createProjectAction,
    {} as ProjectFormState
  );

  const e = (n: string) =>
    s.fields?.[n] && (
      <p className="mt-1 text-xs text-destructive">{s.fields[n]}</p>
    );
  const textFields = [
    "techStack",
    "objective",
    "currentProgress",
    "nextAction",
    "lessonsLearned"
  ] as const;
  return (
    <form action={a} className="space-y-3">
      {project && <input type="hidden" name="id" value={project.id} />}
      <label className="text-sm">
        Title
        <Input
          className="mt-1"
          name="title"
          required
          defaultValue={project?.title}
        />
        {e("title")}
      </label>
      <details open={!!project} className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Project metadata
        </summary>
        <div className="mt-3 space-y-3">
          <Textarea
            name="description"
            placeholder="Short description"
            defaultValue={project?.description ?? ""}
          />
          <div className="grid grid-cols-3 gap-2">
            <Select name="status" defaultValue={project?.status ?? "planned"}>
              {projectStatuses.map((x) => (
                <option key={x} value={x}>
                  {statusLabel(x)}
                </option>
              ))}
            </Select>
            <Select name="type" defaultValue={project?.type ?? "other"}>
              {projectTypes.map((x) => (
                <option key={x} value={x}>
                  {statusLabel(x)}
                </option>
              ))}
            </Select>
            <Select
              name="priority"
              defaultValue={project?.priority ?? "medium"}
            >
              {priorities.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="date"
              name="startDate"
              defaultValue={dateInputValue(project?.startDate)}
            />
            <Input
              type="date"
              name="targetDate"
              defaultValue={dateInputValue(project?.targetDate)}
            />
            <Input
              type="date"
              name="completedAt"
              defaultValue={dateInputValue(project?.completedAt)}
            />
          </div>
          {e("targetDate")}
          {e("completedAt")}
          <Input
            name="repositoryUrl"
            type="url"
            placeholder="Repository URL"
            defaultValue={project?.repositoryUrl ?? ""}
          />
          <Input
            name="localPath"
            placeholder="Local folder path"
            defaultValue={project?.localPath ?? ""}
          />
          <Input
            name="liveUrl"
            type="url"
            placeholder="Live URL"
            defaultValue={project?.liveUrl ?? ""}
          />
          {textFields.map((n) => (
            <Textarea
              key={n}
              name={n}
              placeholder={statusLabel(n)}
              defaultValue={project?.[n] ?? ""}
            />
          ))}
        </div>
      </details>
      {s.message && (
        <p
          role="status"
          className={
            s.ok ? "text-sm text-green-700" : "text-sm text-destructive"
          }
        >
          {s.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={p}>
          {p ? "Saving…" : project ? "Save project" : "Create project"}
        </Button>
        {project && (
          <Button asChild variant="outline">
            <Link href="/projects">Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
