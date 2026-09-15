import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/lib/security/origin";
import { securityHeaders } from "@/lib/security/headers";
import { apiError } from "@/lib/http";

describe("browser mutation origin protection", () => {
  it("accepts an exact same-origin mutation", () => {
    expect(() =>
      assertSameOrigin(
        new Headers({
          host: "hub.example.test",
          origin: "https://hub.example.test"
        })
      )
    ).not.toThrow();
  });

  it("rejects missing, malformed, cross-origin, and non-HTTP origins", () => {
    expect(() =>
      assertSameOrigin(new Headers({ host: "hub.example.test" }))
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Headers({ host: "hub.example.test", origin: "not a URL" })
      )
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Headers({ host: "hub.example.test", origin: "https://evil.test" })
      )
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Headers({
          host: "hub.example.test",
          origin: "file://hub.example.test"
        })
      )
    ).toThrow();
  });

  it("uses a trusted forwarded host only when proxy trust is explicit", () => {
    const headers = new Headers({
      host: "127.0.0.1:3000",
      "x-forwarded-host": "hub.example.test",
      origin: "https://hub.example.test"
    });
    expect(() => assertSameOrigin(headers, false)).toThrow();
    expect(() => assertSameOrigin(headers, true)).not.toThrow();
  });
});

describe("security response headers", () => {
  it("builds a nonce-based production CSP and HTTPS-only HSTS", () => {
    const headers = securityHeaders("test-nonce", true);
    expect(headers["Content-Security-Policy"]).toContain("'nonce-test-nonce'");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'"
    );
    expect(headers["Content-Security-Policy"]).not.toMatch(
      /script-src[^;]*'unsafe-inline'/
    );
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("permits development evaluation without enabling HSTS", () => {
    const headers = securityHeaders("test-nonce", false);
    expect(headers["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });
});

describe("safe API failures", () => {
  it("does not serialize internal error messages or secrets", async () => {
    const response = apiError(
      new Error(
        "Prisma failed at postgresql://owner:secret@database/personalhub"
      )
    );
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(body).toContain("INTERNAL_ERROR");
    expect(body).not.toMatch(/Prisma|postgresql|secret|database/i);
  });
});
