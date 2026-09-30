import { googleOAuthCompletionBounceTarget } from "@/services/integrations/google/completion";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const target = googleOAuthCompletionBounceTarget(
    Object.fromEntries(requestUrl.searchParams)
  );
  return new Response(null, { status: 307, headers: { location: target } });
}
