import { assertLocalAccess, apiError, ok } from "@/lib/http";
import { captureTask, taskDto } from "@/features/tasks/service";
export async function POST(request: Request) {
  try {
    assertLocalAccess(request);
    return ok(taskDto(await captureTask(await request.json())), 201);
  } catch (error) {
    return apiError(error);
  }
}
