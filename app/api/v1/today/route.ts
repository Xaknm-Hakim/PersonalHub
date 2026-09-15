import { apiError, ok, requireApi } from "@/lib/http";
import { planningAttention } from "@/features/planning/service";
/** v1 returns normalized PlanningItem DTOs, including assignment deadlines and project milestones. */
export async function GET(request: Request) {
  try {
    await requireApi(request, "read");
    const result = await planningAttention();
    return ok({ today: result.today, overdue: result.overdue });
  } catch (error) {
    return apiError(error);
  }
}
