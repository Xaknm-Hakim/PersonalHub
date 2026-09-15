import { apiError, assertValidId, jsonBody, ok, requireApi } from "@/lib/http";
import { taskById, taskDto, updateTask } from "@/features/tasks/service";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApi(request, "read");
    const id = (await params).id;
    assertValidId(id);
    const task = await taskById(id);
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
    await requireApi(request, "write");
    const id = (await params).id;
    assertValidId(id);
    const task = await updateTask(id, await jsonBody(request));
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
