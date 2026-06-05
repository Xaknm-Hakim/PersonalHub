import Link from "next/link";
import { createNote, deleteNote, updateNote } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function NotesPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim();
  const [notes, editing, tasks, assignments] = await Promise.all([
    prisma.note.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query } },
              { body: { contains: query } }
            ]
          }
        : {},
      include: { linkedTask: true, linkedAssignment: true },
      orderBy: { updatedAt: "desc" }
    }),
    params.edit ? prisma.note.findUnique({ where: { id: params.edit } }) : null,
    prisma.task.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.assignment.findMany({ orderBy: { deadline: "asc" } })
  ]);

  return (
    <>
      <PageHeader title="Notes" description="Keep study notes, ideas, and references linked to work when useful." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <NoteForm key={editing?.id ?? "new-note"} note={editing} tasks={tasks} assignments={assignments} />
        <section>
          <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_auto]">
            <Input name="q" placeholder="Search title or body" defaultValue={params.q ?? ""} />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
          {notes.length === 0 ? (
            <EmptyState title="No notes found" message="Create a note or try a different search." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="p-4">
                    <Link href={`/notes?edit=${note.id}`} className="font-medium hover:underline">
                      {note.title}
                    </Link>
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>Updated {formatDate(note.updatedAt)}</Badge>
                      {note.linkedTask ? <Badge>Task: {note.linkedTask.title}</Badge> : null}
                      {note.linkedAssignment ? <Badge>{note.linkedAssignment.courseCode}</Badge> : null}
                    </div>
                    <form action={deleteNote} className="mt-3">
                      <input type="hidden" name="id" value={note.id} />
                      <Button type="submit" variant="destructive" size="sm">Delete</Button>
                    </form>
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

function NoteForm({
  note,
  tasks,
  assignments
}: {
  note: Awaited<ReturnType<typeof prisma.note.findUnique>>;
  tasks: Awaited<ReturnType<typeof prisma.task.findMany>>;
  assignments: Awaited<ReturnType<typeof prisma.assignment.findMany>>;
}) {
  const action = note ? updateNote : createNote;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{note ? "Edit note" : "Create note"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          {note ? <input type="hidden" name="id" value={note.id} /> : null}
          <Input name="title" placeholder="Note title" defaultValue={note?.title ?? ""} required />
          <Textarea name="body" placeholder="Write your note" defaultValue={note?.body ?? ""} required />
          <Select name="linkedTaskId" defaultValue={note?.linkedTaskId ?? ""}>
            <option value="">No linked task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </Select>
          <Select name="linkedAssignmentId" defaultValue={note?.linkedAssignmentId ?? ""}>
            <option value="">No linked assignment</option>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.courseCode}: {assignment.title}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit">{note ? "Save note" : "Create note"}</Button>
            {note ? <Button asChild variant="outline"><Link href="/notes">Cancel</Link></Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
