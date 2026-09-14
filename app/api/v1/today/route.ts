import { assertLocalAccess, apiError, ok } from "@/lib/http";
import { planningAttention } from "@/features/planning/service";
/** v1 returns normalized PlanningItem DTOs, including assignment deadlines and project milestones. */
export async function GET(request: Request) {
  try {
    assertLocalAccess(request);
    const result = await planningAttention();
    return ok({ today: result.today, overdue: result.overdue });
  } catch (error) {
    return apiError(error);
  }
}
