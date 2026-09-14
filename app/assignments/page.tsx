import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAssignmentAction } from "@/features/assignments/actions";
import { AssignmentForm } from "@/features/assignments/components/assignment-form";
import { DeleteControl } from "@/components/delete-control";
import { findTags } from "@/features/tags/service";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  assignmentById,
  assignmentCourses,
  findAssignments
} from "@/features/assignments/service";
import {
  assignmentStatuses,
  assignmentTypes,
  priorities
} from "@/lib/constants";
import { isClosed } from "@/lib/domain/status";
import {
  formatDate,
  isBeforeToday,
  priorityClass,
  statusLabel
} from "@/lib/utils";

export default async function AssignmentsPage({
  searchParams
}: {
  searchParams: Promise<{
    course?: string;
    type?: string;
    status?: string;
    priority?: string;
    edit?: string;
  }>;
}) {
  const params = await searchParams;
  const courses = await assignmentCourses();
  const [assignments, editing, tags] = await Promise.all([
    findAssignments(params),
    params.edit ? assignmentById(params.edit) : null,
    findTags()
  ]);
  if (params.edit && !editing) notFound();

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Plan coursework, exercises, labs, projects, and deadlines."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              {editing ? "Edit assignment" : "Create assignment"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AssignmentForm
              key={editing?.id ?? "new-assignment"}
              assignment={editing}
              tags={tags}
            />
          </CardContent>
        </Card>
        <section>
          <form className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-5">
            <Select name="course" defaultValue={params.course ?? ""}>
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.courseCode} value={course.courseCode}>
                  {course.courseCode}
                </option>
              ))}
            </Select>
            <Select name="type" defaultValue={params.type ?? ""}>
              <option value="">All types</option>
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>
                  {statusLabel(type)}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {assignmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
            <Select name="priority" defaultValue={params.priority ?? ""}>
              <option value="">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
          {assignments.length === 0 ? (
            <EmptyState
              title="No assignments found"
              message="Create an assignment or clear your filters."
            />
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const overdue =
                  !isClosed("assignment", assignment.status) &&
                  isBeforeToday(assignment.deadline);
                return (
                  <Card
                    key={assignment.id}
                    className={
                      overdue ? "border-red-300 dark:border-red-800" : ""
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/assignments?edit=${assignment.id}`}
                            className="font-medium hover:underline"
                          >
                            {assignment.courseCode}: {assignment.title}
                          </Link>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {assignment.courseName}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {assignment.description || "No description"}
                          </p>
                          <p
                            className={
                              overdue
                                ? "mt-2 text-sm font-medium text-red-600 dark:text-red-300"
                                : "mt-2 text-sm text-muted-foreground"
                            }
                          >
                            Deadline {formatDate(assignment.deadline)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{statusLabel(assignment.type)}</Badge>
                          <Badge>{statusLabel(assignment.status)}</Badge>
                          <Badge className={priorityClass(assignment.priority)}>
                            {assignment.priority}
                          </Badge>
                          {overdue ? (
                            <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                              Overdue
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3">
                        <DeleteControl
                          action={deleteAssignmentAction}
                          id={assignment.id}
                        />
                      </div>
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
