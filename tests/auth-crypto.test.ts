import { describe, expect, it } from "vitest";
import {
  generateApiToken,
  generateSessionToken,
  hashOpaqueToken,
  hashPassword,
  parseApiToken,
  verifyPassword
} from "@/lib/auth/crypto";

describe("authentication cryptography", () => {
  it("hashes passwords with scrypt and verifies without storing plaintext", async () => {
    const hash = await hashPassword("a sufficiently long owner password");

    expect(hash).toMatch(/^scrypt\$v=1\$/);
    expect(hash).not.toContain("sufficiently long owner password");
    await expect(
      verifyPassword("a sufficiently long owner password", hash)
    ).resolves.toBe(true);
    await expect(verifyPassword("the wrong password", hash)).resolves.toBe(
      false
    );
  });

  it("rejects malformed password hashes safely", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
  });

  it("creates opaque high-entropy session tokens whose digest is deterministic", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).toMatch(/^phs1\.[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(hashOpaqueToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOpaqueToken(first)).toBe(hashOpaqueToken(first));
  });

  it("creates parseable API credentials with separate public ids and secrets", () => {
    const issued = generateApiToken();
    const parsed = parseApiToken(issued.plaintext);

    expect(issued.plaintext).toMatch(
      /^phv1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{43}$/
    );
    expect(parsed).toEqual({ id: issued.id, secret: issued.secret });
    expect(parseApiToken("Bearer nope")).toBeNull();
    expect(parseApiToken("phv1.too.short")).toBeNull();
  });
});
