import Link from "next/link";
import { createAssignment, deleteAssignment, updateAssignment } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { assignmentStatuses, assignmentTypes, priorities } from "@/lib/constants";
import { dateInputValue, formatDate, isBeforeToday, priorityClass, statusLabel } from "@/lib/utils";

export default async function AssignmentsPage({
  searchParams
}: {
  searchParams: Promise<{ course?: string; type?: string; status?: string; priority?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const courses = await prisma.assignment.findMany({ select: { courseCode: true }, distinct: ["courseCode"], orderBy: { courseCode: "asc" } });
  const where = {
    ...(params.course ? { courseCode: params.course } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {})
  };
  const [assignments, editing] = await Promise.all([
    prisma.assignment.findMany({ where, orderBy: { deadline: "asc" } }),
    params.edit ? prisma.assignment.findUnique({ where: { id: params.edit } }) : null
  ]);

  return (
    <>
      <PageHeader title="Assignments" description="Plan coursework, exercises, labs, projects, and deadlines." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <AssignmentForm key={editing?.id ?? "new-assignment"} mode={editing ? "Edit assignment" : "Create assignment"} assignment={editing} />
        <section>
          <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-5">
            <Select name="course" defaultValue={params.course ?? ""}>
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.courseCode} value={course.courseCode}>{course.courseCode}</option>
              ))}
            </Select>
            <Select name="type" defaultValue={params.type ?? ""}>
              <option value="">All types</option>
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>{statusLabel(type)}</option>
              ))}
            </Select>
            <Select name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {assignmentStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </Select>
            <Select name="priority" defaultValue={params.priority ?? ""}>
              <option value="">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
          {assignments.length === 0 ? (
            <EmptyState title="No assignments found" message="Create an assignment or clear your filters." />
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const overdue =
                  !["submitted", "graded", "cancelled"].includes(assignment.status) && isBeforeToday(assignment.deadline);
                return (
                  <Card key={assignment.id} className={overdue ? "border-red-300 dark:border-red-800" : ""}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link href={`/assignments?edit=${assignment.id}`} className="font-medium hover:underline">
                            {assignment.courseCode}: {assignment.title}
                          </Link>
                          <p className="mt-1 text-sm text-muted-foreground">{assignment.courseName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{assignment.description || "No description"}</p>
                          <p className={overdue ? "mt-2 text-sm font-medium text-red-600 dark:text-red-300" : "mt-2 text-sm text-muted-foreground"}>
                            Deadline {formatDate(assignment.deadline)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{statusLabel(assignment.type)}</Badge>
                          <Badge>{statusLabel(assignment.status)}</Badge>
                          <Badge className={priorityClass(assignment.priority)}>{assignment.priority}</Badge>
                          {overdue ? <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">Overdue</Badge> : null}
                        </div>
                      </div>
                      <form action={deleteAssignment} className="mt-3">
                        <input type="hidden" name="id" value={assignment.id} />
                        <Button type="submit" variant="destructive" size="sm">Delete</Button>
                      </form>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function AssignmentForm({
  mode,
  assignment
}: {
  mode: string;
  assignment: Awaited<ReturnType<typeof prisma.assignment.findUnique>>;
}) {
  const action = assignment ? updateAssignment : createAssignment;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          {assignment ? <input type="hidden" name="id" value={assignment.id} /> : null}
          <div className="grid grid-cols-2 gap-3">
            <Input name="courseCode" placeholder="Course code" defaultValue={assignment?.courseCode ?? ""} required />
            <Input name="courseName" placeholder="Course name" defaultValue={assignment?.courseName ?? ""} required />
          </div>
          <Input name="title" placeholder="Assignment title" defaultValue={assignment?.title ?? ""} required />
          <Textarea name="description" placeholder="Description" defaultValue={assignment?.description ?? ""} />
          <Select name="type" defaultValue={assignment?.type ?? "assignment"}>
            {assignmentTypes.map((type) => (
              <option key={type} value={type}>{statusLabel(type)}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select name="status" defaultValue={assignment?.status ?? "not_started"}>
              {assignmentStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </Select>
            <Select name="priority" defaultValue={assignment?.priority ?? "medium"}>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              Start date
              <Input className="mt-1" type="date" name="startDate" defaultValue={dateInputValue(assignment?.startDate)} />
            </label>
            <label className="text-sm font-medium">
              Deadline
              <Input className="mt-1" type="date" name="deadline" defaultValue={dateInputValue(assignment?.deadline)} required />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">{assignment ? "Save assignment" : "Create assignment"}</Button>
            {assignment ? <Button asChild variant="outline"><Link href="/assignments">Cancel</Link></Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
