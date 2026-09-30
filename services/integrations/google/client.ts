import type { GoogleCalendarGateway, GoogleEventProjection } from "./sync";
import { GOOGLE_CALENDAR_SCOPES } from "./constants";

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type RetryOptions = {
  fetchImplementation?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  requestTimeoutMs?: number;
};

export class GoogleIntegrationError extends Error {
  constructor(
    public code: string,
    public status?: number
  ) {
    super("Google Calendar operation failed.");
    this.name = "GoogleIntegrationError";
  }
}

function safeErrorCode(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const candidate = body as {
    error?: string | { errors?: Array<{ reason?: string }>; status?: string };
  };
  if (typeof candidate.error === "string") return candidate.error;
  return candidate.error?.errors?.[0]?.reason ?? candidate.error?.status;
}

async function parseJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new GoogleIntegrationError("MALFORMED_RESPONSE", response.status);
  }
}

function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(seconds * 1000, 5_000);
  return Math.min(250 * 2 ** attempt, 2_000);
}

function retryable(status: number, code?: string) {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    (status === 403 &&
      ["rateLimitExceeded", "userRateLimitExceeded"].includes(code ?? ""))
  );
}

async function googleRequest(
  url: string,
  init: RequestInit,
  options: RetryOptions = {}
) {
  const request = options.fetchImplementation ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0)
    throw new GoogleIntegrationError("INVALID_CONFIGURATION");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await request(url, {
        ...init,
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
    } catch (error) {
      if (attempt === 2)
        throw new GoogleIntegrationError(
          error instanceof DOMException &&
            ["AbortError", "TimeoutError"].includes(error.name)
            ? "REQUEST_TIMEOUT"
            : "NETWORK_ERROR"
        );
      await sleep(250 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response;
    const body = await parseJson(response);
    const code = safeErrorCode(body) ?? `HTTP_${response.status}`;
    if (attempt < 2 && retryable(response.status, code)) {
      await sleep(retryDelay(response, attempt));
      continue;
    }
    throw new GoogleIntegrationError(code, response.status);
  }
  throw new GoogleIntegrationError("UNAVAILABLE");
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
  options: RetryOptions = {}
) {
  const response = await googleRequest(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri
      })
    },
    options
  );
  const body = (await parseJson(response)) as {
    refresh_token?: unknown;
    scope?: unknown;
  };
  if (typeof body.refresh_token !== "string" || !body.refresh_token)
    throw new GoogleIntegrationError("MISSING_REFRESH_TOKEN");
  if (typeof body.scope !== "string")
    throw new GoogleIntegrationError("MALFORMED_RESPONSE");
  const grantedScopes = new Set(body.scope.split(/\s+/).filter(Boolean));
  if (GOOGLE_CALENDAR_SCOPES.some((scope) => !grantedScopes.has(scope)))
    throw new GoogleIntegrationError("INSUFFICIENT_SCOPE");
  return { refreshToken: body.refresh_token };
}

export async function refreshGoogleAccessToken(
  config: Omit<GoogleOAuthConfig, "redirectUri">,
  refreshToken: string,
  options: RetryOptions = {}
) {
  try {
    const response = await googleRequest(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      },
      options
    );
    const body = (await parseJson(response)) as { access_token?: unknown };
    if (typeof body.access_token !== "string" || !body.access_token)
      throw new GoogleIntegrationError("MALFORMED_RESPONSE");
    return body.access_token;
  } catch (error) {
    if (
      error instanceof GoogleIntegrationError &&
      error.code === "invalid_grant"
    )
      throw new GoogleIntegrationError(
        "REAUTHORIZATION_REQUIRED",
        error.status
      );
    throw error;
  }
}

export async function revokeGoogleAuthorization(
  refreshToken: string,
  options: RetryOptions = {}
) {
  try {
    await googleRequest(
      "https://oauth2.googleapis.com/revoke",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken })
      },
      options
    );
    return true;
  } catch {
    return false;
  }
}

export class GoogleCalendarApi implements GoogleCalendarGateway {
  constructor(
    private accessToken: string,
    private options: RetryOptions = {}
  ) {}

  private request(path: string, init: RequestInit = {}) {
    return googleRequest(
      `https://www.googleapis.com/calendar/v3${path}`,
      {
        ...init,
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers
        }
      },
      this.options
    );
  }

  async createCalendar(summary: string, managementMarker: string) {
    const response = await this.request("/calendars", {
      method: "POST",
      body: JSON.stringify({
        summary,
        description: `Managed by PersonalHub (${managementMarker})`
      })
    });
    const body = (await parseJson(response)) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id)
      throw new GoogleIntegrationError("MALFORMED_RESPONSE");
    return body.id;
  }

  async findManagedCalendars(managementMarker: string) {
    const expectedDescription = `Managed by PersonalHub (${managementMarker})`;
    const matches: string[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const query = new URLSearchParams({ maxResults: "250" });
      if (pageToken) query.set("pageToken", pageToken);
      const response = await this.request(`/users/me/calendarList?${query}`);
      const body = (await parseJson(response)) as {
        items?: unknown;
        nextPageToken?: unknown;
      };
      if (body.items !== undefined && !Array.isArray(body.items))
        throw new GoogleIntegrationError("MALFORMED_RESPONSE");
      for (const item of body.items ?? []) {
        if (!item || typeof item !== "object")
          throw new GoogleIntegrationError("MALFORMED_RESPONSE");
        const calendar = item as { id?: unknown; description?: unknown };
        if (
          calendar.description === expectedDescription &&
          typeof calendar.id === "string" &&
          calendar.id
        )
          matches.push(calendar.id);
      }
      if (body.nextPageToken === undefined) break;
      if (typeof body.nextPageToken !== "string" || !body.nextPageToken)
        throw new GoogleIntegrationError("MALFORMED_RESPONSE");
      pageToken = body.nextPageToken;
      if (page === 9)
        throw new GoogleIntegrationError("CALENDAR_LIST_TOO_LARGE");
    }
    return [...new Set(matches)].sort();
  }

  async calendarExists(calendarId: string) {
    try {
      await this.request(`/calendars/${encodeURIComponent(calendarId)}`);
      return true;
    } catch (error) {
      if (error instanceof GoogleIntegrationError && error.status === 404)
        return false;
      throw error;
    }
  }

  async upsertEvent(
    calendarId: string,
    eventId: string,
    projection: GoogleEventProjection
  ) {
    const body = JSON.stringify({
      id: eventId,
      summary: projection.summary,
      description:
        "Managed by PersonalHub. Google-side edits may be overwritten by Sync Now.",
      start: { date: projection.startDate },
      end: { date: projection.endDate },
      extendedProperties: {
        private: {
          personalhubEntityType: projection.localEntityType,
          personalhubEntityId: projection.localEntityId,
          personalhubProjectionVersion: "1"
        }
      }
    });
    try {
      const response = await this.request(
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        { method: "POST", body }
      );
      const created = (await parseJson(response)) as { id?: unknown };
      if (created.id !== eventId)
        throw new GoogleIntegrationError("MALFORMED_RESPONSE");
      return eventId;
    } catch (error) {
      if (!(error instanceof GoogleIntegrationError) || error.status !== 409)
        throw error;
      const response = await this.request(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "PUT", body }
      );
      const updated = (await parseJson(response)) as { id?: unknown };
      if (updated.id !== eventId)
        throw new GoogleIntegrationError("MALFORMED_RESPONSE");
      return eventId;
    }
  }

  async deleteEvent(calendarId: string, eventId: string) {
    try {
      await this.request(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" }
      );
    } catch (error) {
      if (error instanceof GoogleIntegrationError && error.status === 404)
        return;
      throw error;
    }
  }
}
