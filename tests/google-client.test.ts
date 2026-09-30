import { describe, expect, it, vi } from "vitest";
import {
  exchangeGoogleAuthorizationCode,
  GoogleCalendarApi,
  GoogleIntegrationError,
  refreshGoogleAccessToken
} from "@/services/integrations/google/client";
import { GOOGLE_CALENDAR_SCOPE } from "@/services/integrations/google/constants";

const projection = {
  summary: "Task: Test",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  localEntityType: "task" as const,
  localEntityId: "task-1"
};

describe("Google HTTP boundary", () => {
  it("sends the authorization code exchange using Google's exact form contract", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          refresh_token: "refresh",
          scope: GOOGLE_CALENDAR_SCOPE
        }),
        { status: 200 }
      )
    );
    await exchangeGoogleAuthorizationCode(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://personalhub.example/oauth-callback"
      },
      "authorization-code",
      "pkce-verifier",
      { fetchImplementation: request }
    );

    expect(request).toHaveBeenCalledOnce();
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" }
    });
    expect(new URLSearchParams(init.body as URLSearchParams)).toEqual(
      new URLSearchParams({
        client_id: "client-id",
        client_secret: "client-secret",
        code: "authorization-code",
        code_verifier: "pkce-verifier",
        grant_type: "authorization_code",
        redirect_uri: "https://personalhub.example/oauth-callback"
      })
    );
  });

  it("accepts refresh authorization only when both selected scopes were granted", async () => {
    const config = {
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://personalhub.example/callback"
    };
    const response = (scope: string) =>
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ refresh_token: "refresh", scope }), {
          status: 200
        })
      );
    await expect(
      exchangeGoogleAuthorizationCode(config, "code", "verifier", {
        fetchImplementation: response(GOOGLE_CALENDAR_SCOPE)
      })
    ).resolves.toEqual({ refreshToken: "refresh" });
    await expect(
      exchangeGoogleAuthorizationCode(config, "code", "verifier", {
        fetchImplementation: response(
          "https://www.googleapis.com/auth/calendar.app.created"
        )
      })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SCOPE" });
  });

  it("normalizes revoked authorization without exposing response content", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );
    await expect(
      refreshGoogleAccessToken(
        { clientId: "client", clientSecret: "secret" },
        "refresh-secret",
        { fetchImplementation: request }
      )
    ).rejects.toMatchObject({
      name: "GoogleIntegrationError",
      code: "REAUTHORIZATION_REQUIRED",
      message: "Google Calendar operation failed."
    });
  });

  it.each([
    ["invalid_grant", 400],
    ["invalid_client", 401],
    ["unknown_provider_value", 400]
  ])(
    "preserves provider code %s only for internal classification",
    async (code, status) => {
      await expect(
        exchangeGoogleAuthorizationCode(
          {
            clientId: "client",
            clientSecret: "secret",
            redirectUri: "https://personalhub.example/callback"
          },
          "authorization-code",
          "pkce-verifier",
          {
            fetchImplementation: vi.fn().mockResolvedValue(
              new Response(
                JSON.stringify({
                  error: code,
                  error_description: "raw-provider-description"
                }),
                { status }
              )
            )
          }
        )
      ).rejects.toMatchObject({
        code,
        status,
        message: "Google Calendar operation failed."
      });
    }
  );

  it("preserves provider unavailability after bounded retries", async () => {
    const request = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
          status: 503
        })
    );
    await expect(
      exchangeGoogleAuthorizationCode(
        {
          clientId: "client",
          clientSecret: "secret",
          redirectUri: "https://personalhub.example/callback"
        },
        "authorization-code",
        "pkce-verifier",
        {
          fetchImplementation: request,
          sleep: async () => undefined
        }
      )
    ).rejects.toMatchObject({ code: "temporarily_unavailable", status: 503 });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([
    [new DOMException("timed out", "TimeoutError"), "REQUEST_TIMEOUT"],
    [new Error("network detail"), "NETWORK_ERROR"]
  ])("classifies a failed token request as %s", async (failure, code) => {
    const request = vi.fn().mockRejectedValue(failure);
    await expect(
      exchangeGoogleAuthorizationCode(
        {
          clientId: "client",
          clientSecret: "secret",
          redirectUri: "https://personalhub.example/callback"
        },
        "code",
        "verifier",
        {
          fetchImplementation: request,
          sleep: async () => undefined,
          requestTimeoutMs: 5
        }
      )
    ).rejects.toMatchObject({ code });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("classifies a malformed successful token response", async () => {
    await expect(
      exchangeGoogleAuthorizationCode(
        {
          clientId: "client",
          clientSecret: "secret",
          redirectUri: "https://personalhub.example/callback"
        },
        "code",
        "verifier",
        {
          fetchImplementation: vi
            .fn()
            .mockResolvedValue(new Response("not-json", { status: 200 }))
        }
      )
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("uses bounded retry with Retry-After for rate limits", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { errors: [{ reason: "rateLimitExceeded" }] }
          }),
          { status: 429, headers: { "retry-after": "1" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access" }), {
          status: 200
        })
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      refreshGoogleAccessToken(
        { clientId: "client", clientSecret: "secret" },
        "refresh",
        { fetchImplementation: request, sleep }
      )
    ).resolves.toBe("access");
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("bounds every provider request so a lease cannot expire behind a hung fetch", async () => {
    const request = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );
    const client = new GoogleCalendarApi("access-token", {
      fetchImplementation: request as typeof fetch,
      requestTimeoutMs: 5,
      sleep: async () => undefined
    });

    await expect(client.calendarExists("calendar-id")).rejects.toEqual(
      expect.objectContaining({ code: "REQUEST_TIMEOUT" })
    );
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("converges deterministic event creation after a conflict", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { status: "ALREADY_EXISTS" } }), {
          status: 409
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "phexisting" }), { status: 200 })
      );
    const client = new GoogleCalendarApi("access", {
      fetchImplementation: request
    });
    await expect(
      client.upsertEvent("calendar", "phexisting", projection)
    ).resolves.toBe("phexisting");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).toMatchObject({ method: "PUT" });
  });

  it("rejects malformed success responses safely", async () => {
    const client = new GoogleCalendarApi("access", {
      fetchImplementation: vi
        .fn()
        .mockResolvedValue(new Response("{}", { status: 200 }))
    });
    await expect(
      client.createCalendar("PersonalHub", "personalhub-integration:test")
    ).rejects.toEqual(
      expect.objectContaining<Partial<GoogleIntegrationError>>({
        code: "MALFORMED_RESPONSE",
        message: "Google Calendar operation failed."
      })
    );
  });

  it("discovers only calendars with the exact stable management marker", async () => {
    const marker = "personalhub-integration:integration-1";
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: "title-only", summary: "PersonalHub" },
            {
              id: "managed",
              summary: "Renamed by user",
              description: `Managed by PersonalHub (${marker})`
            },
            {
              id: "other-managed",
              description:
                "Managed by PersonalHub (personalhub-integration:other)"
            }
          ]
        }),
        { status: 200 }
      )
    );
    const client = new GoogleCalendarApi("access", {
      fetchImplementation: request
    });
    await expect(client.findManagedCalendars(marker)).resolves.toEqual([
      "managed"
    ]);
    expect(request.mock.calls[0][0]).toContain("/users/me/calendarList?");
  });
});
