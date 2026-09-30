import { NextResponse } from "next/server";
import { requireOwnerAction } from "@/lib/auth/web-session";
import { googleIntegrationEnv } from "@/lib/env";
import { OriginError } from "@/lib/security/origin";
import { runGoogleCalendarSync } from "@/services/integrations/google/service";

export async function POST(_request: Request) {
  void _request;
  try {
    await requireOwnerAction();
  } catch (error) {
    if (!(error instanceof OriginError)) throw error;
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }
  const config = googleIntegrationEnv();
  try {
    await runGoogleCalendarSync();
    return NextResponse.redirect(
      `${config.publicOrigin}/settings?google=synced`,
      303
    );
  } catch {
    return NextResponse.redirect(
      `${config.publicOrigin}/settings?google=sync_error`,
      303
    );
  }
}
