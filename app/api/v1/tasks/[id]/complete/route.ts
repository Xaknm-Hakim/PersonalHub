import { assertLocalAccess, apiError, ok } from "@/lib/http";
import { completeTask, taskDto } from "@/features/tasks/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertLocalAccess(request);
    const task = await completeTask((await params).id);
    return task
      ? ok(taskDto(task))
      : Response.json(
          { error: { code: "NOT_FOUND", message: "Task was not found." } },
          { status: 404 }
        );
  } catch (error) {
    return apiError(error);
  }
}
