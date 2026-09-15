import { apiError, assertValidId, ok, requireApi } from "@/lib/http";
import { completeTask, taskDto } from "@/features/tasks/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApi(request, "write");
    const id = (await params).id;
    assertValidId(id);
    const task = await completeTask(id);
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
