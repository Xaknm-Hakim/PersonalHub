"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { Note } from "@prisma/client";
import {
  createNoteAction,
  type NoteFormState,
  updateNoteAction
} from "@/features/notes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
type Item = { id: string; title: string };
type Assignment = { id: string; courseCode: string; title: string };
type Tag = { id: string; name: string };
type NoteWithTags = Note & { tags: Tag[] };
export function NoteForm({
  note,
  tasks,
  assignments,
  projects,
  tags
}: {
  note: NoteWithTags | null;
  tasks: Item[];
  assignments: Assignment[];
  projects: Item[];
  tags: Tag[];
}) {
  const [s, a, p] = useActionState(
    note ? updateNoteAction : createNoteAction,
    {} as NoteFormState
  );

  const e = (n: string) =>
    s.fields?.[n] && (
      <p className="mt-1 text-xs text-destructive">{s.fields[n]}</p>
    );
  return (
    <form action={a} className="space-y-3">
      {note && <input type="hidden" name="id" value={note.id} />}
      <label className="text-sm">
        Title
        <Input
          className="mt-1"
          name="title"
          required
          defaultValue={note?.title}
        />
        {e("title")}
      </label>
      <label className="text-sm">
        Body
        <Textarea
          className="mt-1"
          name="body"
          required
          defaultValue={note?.body ?? ""}
        />
        {e("body")}
      </label>
      <details open={!!note} className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Links and tags
        </summary>
        <div className="mt-3 space-y-3">
          <Select name="linkedTaskId" defaultValue={note?.linkedTaskId ?? ""}>
            <option value="">No linked task</option>
            {tasks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </Select>
          <Select
            name="linkedAssignmentId"
            defaultValue={note?.linkedAssignmentId ?? ""}
          >
            <option value="">No linked assignment</option>
            {assignments.map((x) => (
              <option key={x.id} value={x.id}>
                {x.courseCode}: {x.title}
              </option>
            ))}
          </Select>
          <Select name="projectId" defaultValue={note?.projectId ?? ""}>
            <option value="">No linked project</option>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </Select>
          <fieldset>
            <legend className="text-sm">Tags</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {tags.map((t) => (
                <label className="text-sm" key={t.id}>
                  <input
                    className="mr-1"
                    type="checkbox"
                    name="tagIds"
                    value={t.id}
                    defaultChecked={note?.tags.some((x: Tag) => x.id === t.id)}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </fieldset>
          {e("relationships")}
          {e("tagIds")}
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
          {p ? "Saving…" : note ? "Save note" : "Create note"}
        </Button>
        {note && (
          <Button asChild variant="outline">
            <Link href="/notes">Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
