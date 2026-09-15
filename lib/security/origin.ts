export class OriginError extends Error {
  constructor() {
    super("Mutation origin is not allowed.");
    this.name = "OriginError";
  }
}

export function assertSameOrigin(headers: Headers, trustProxy = false) {
  const origin = headers.get("origin");
  const directHost = headers.get("host");
  const forwardedHost = trustProxy ? headers.get("x-forwarded-host") : null;
  const host = forwardedHost || directHost;
  if (!origin || !host || host.includes(",")) throw new OriginError();
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new OriginError();
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.host.toLowerCase() !== host.toLowerCase()
  )
    throw new OriginError();
}
