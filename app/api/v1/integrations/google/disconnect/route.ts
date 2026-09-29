import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth/web-session";
import { googleIntegrationEnv } from "@/lib/env";
import { disconnectGoogle } from "@/services/integrations/google/service";

export async function POST(request: Request) {
  await requireOwnerSession();
  const config = googleIntegrationEnv();
  if (request.headers.get("origin") !== config.publicOrigin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  await disconnectGoogle();
  return NextResponse.redirect(
    `${config.publicOrigin}/settings?google=disconnected`,
    303
  );
}
