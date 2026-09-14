import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteNoteAction } from "@/features/notes/actions";
import { NoteForm } from "@/features/notes/components/note-form";
import { DeleteControl } from "@/components/delete-control";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { findNotes, noteById } from "@/features/notes/service";
import { findTasks } from "@/features/tasks/service";
import { findAssignments } from "@/features/assignments/service";
import { findProjects } from "@/features/projects/service";
import { findTags } from "@/features/tags/service";
import { formatDate } from "@/lib/utils";

export default async function NotesPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; tag?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim();
  const [notes, editing, tasks, assignments, projects, tags] =
    await Promise.all([
      findNotes(query, params.tag),
      params.edit ? noteById(params.edit) : null,
      findTasks(),
      findAssignments(),
      findProjects(),
      findTags()
    ]);
  if (params.edit && !editing) notFound();

  return (
    <>
      <PageHeader
        title="Notes"
        description="Keep study notes, ideas, and references linked to work when useful."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit note" : "Create note"}</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm
              key={editing?.id ?? "new-note"}
              note={editing}
              tasks={tasks}
              assignments={assignments}
              projects={projects}
              tags={tags}
            />
          </CardContent>
        </Card>
        <section>
          <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_auto_auto]">
            <Input
              name="q"
              placeholder="Search title or body"
              defaultValue={params.q ?? ""}
            />
            <Select name="tag" defaultValue={params.tag ?? ""}>
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          {notes.length === 0 ? (
            <EmptyState
              title="No notes found"
              message="Create a note or try a different search."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="p-4">
                    <Link
                      href={`/notes?edit=${note.id}`}
                      className="font-medium hover:underline"
                    >
                      {note.title}
                    </Link>
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                      {note.body}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>Updated {formatDate(note.updatedAt)}</Badge>
                      {note.linkedTask ? (
                        <Badge>Task: {note.linkedTask.title}</Badge>
                      ) : null}
                      {note.linkedAssignment ? (
                        <Badge>{note.linkedAssignment.courseCode}</Badge>
                      ) : null}
                      {note.project ? (
                        <Badge>Project: {note.project.title}</Badge>
                      ) : null}
                      {note.tags.map((tag) => (
                        <Badge key={tag.id}>{tag.name}</Badge>
                      ))}
                    </div>
                    <div className="mt-3">
                      <DeleteControl action={deleteNoteAction} id={note.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
