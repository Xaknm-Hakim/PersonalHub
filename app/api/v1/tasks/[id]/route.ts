import { assertLocalAccess, apiError, ok } from "@/lib/http";
import { taskById, taskDto, updateTask } from "@/features/tasks/service";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertLocalAccess(request);
    const task = await taskById((await params).id);
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
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertLocalAccess(request);
    const task = await updateTask((await params).id, await request.json());
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
