import { assertLocalAccess, apiError, ok } from "@/lib/http";
import { createTask, findTasks, taskDto } from "@/features/tasks/service";
import { priorities, taskStatuses } from "@/lib/domain/status";
import { parse } from "@/lib/domain/validation";
import { z } from "zod";
const query = z
  .object({
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(priorities).optional(),
    q: z.string().trim().max(300).optional(),
    tagId: z.string().trim().max(191).optional()
  })
  .strict();
export async function GET(request: Request) {
  try {
    assertLocalAccess(request);
    const p = new URL(request.url).searchParams;
    const filters = parse(
      query,
      Object.fromEntries([...p.entries()].filter(([, value]) => value !== ""))
    );
    const tasks = await findTasks(filters);
    return ok(tasks.map((task) => taskDto(task)));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertLocalAccess(request);
    return ok(taskDto(await createTask(await request.json())), 201);
  } catch (error) {
    return apiError(error);
  }
}
