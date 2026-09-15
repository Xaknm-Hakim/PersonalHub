import { apiError, jsonBody, ok, requireApi } from "@/lib/http";
import { captureTask, taskDto } from "@/features/tasks/service";
export async function POST(request: Request) {
  try {
    await requireApi(request, "write");
    return ok(taskDto(await captureTask(await jsonBody(request))), 201);
  } catch (error) {
    return apiError(error);
  }
}
