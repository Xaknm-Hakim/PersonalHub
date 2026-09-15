import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logging";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logEvent("error", "health_check_failed", {
      errorType: error instanceof Error ? error.name : typeof error
    });
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
