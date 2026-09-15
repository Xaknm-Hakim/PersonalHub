import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  OwnerAlreadyExistsError,
  bootstrapOwner,
  loginOwner,
  revokeSession,
  validateSessionToken
} from "@/lib/auth/owner";
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  verifyApiBearer
} from "@/lib/auth/api-tokens";
import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";

disposableDatabase();

async function clearSecurityData() {
  await assertDisposableDatabase((sql) => prisma.$queryRawUnsafe(sql));
  await prisma.loginThrottle.deleteMany();
  await prisma.session.deleteMany();
  await prisma.apiToken.deleteMany();
  await prisma.owner.deleteMany();
}

describe("single-owner authentication", () => {
  beforeEach(clearSecurityData);
  afterAll(async () => prisma.$disconnect());

  it("bootstraps once, verifies a correct password, and rejects an incorrect password", async () => {
    await bootstrapOwner("correct horse battery staple");
    await expect(
      bootstrapOwner("a different sufficiently long password")
    ).rejects.toBeInstanceOf(OwnerAlreadyExistsError);

    const rejected = await loginOwner("wrong password", "test-client");
    expect(rejected).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
    expect(await loginOwner("", "empty-client")).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS"
    });

    const accepted = await loginOwner(
      "correct horse battery staple",
      "test-client"
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("Expected login to succeed.");
    expect(accepted.token).toMatch(/^phs1\./);
    expect(await validateSessionToken(accepted.token)).toMatchObject({
      ownerId: "owner"
    });
    const another = await loginOwner(
      "correct horse battery staple",
      "second-device"
    );
    expect(another).toMatchObject({ ok: true });
    if (!another.ok) throw new Error("Expected second login to succeed.");
    expect(another.token).not.toBe(accepted.token);
  });

  it("expires and revokes opaque sessions", async () => {
    await bootstrapOwner("correct horse battery staple");
    const login = await loginOwner(
      "correct horse battery staple",
      "test-client"
    );
    if (!login.ok) throw new Error("Expected login to succeed.");

    await prisma.session.updateMany({ data: { expiresAt: new Date(0) } });
    expect(await validateSessionToken(login.token)).toBeNull();

    const second = await loginOwner(
      "correct horse battery staple",
      "test-client"
    );
    if (!second.ok) throw new Error("Expected login to succeed.");
    await revokeSession(second.token);
    expect(await validateSessionToken(second.token)).toBeNull();

    const stale = await loginOwner(
      "correct horse battery staple",
      "versioned-client"
    );
    if (!stale.ok) throw new Error("Expected login to succeed.");
    await prisma.owner.update({
      where: { id: "owner" },
      data: { authVersion: { increment: 1 } }
    });
    expect(await validateSessionToken(stale.token)).toBeNull();
  });

  it("temporarily throttles repeated login failures without permanent lockout", async () => {
    await bootstrapOwner("correct horse battery staple");
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(
        await loginOwner("wrong password", "abusive-client")
      ).toMatchObject({
        ok: false
      });
    }
    expect(await loginOwner("wrong password", "abusive-client")).toEqual({
      ok: false,
      reason: "RATE_LIMITED"
    });
    await prisma.loginThrottle.updateMany({
      data: { blockedUntil: new Date(0) }
    });
    expect(
      await loginOwner("correct horse battery staple", "abusive-client")
    ).toMatchObject({ ok: true });
  });
});

describe("owner API tokens", () => {
  beforeEach(clearSecurityData);

  it("shows a random credential once, stores only its digest, and lists metadata", async () => {
    await bootstrapOwner("correct horse battery staple");
    const issued = await createApiToken({
      name: "Quickshell",
      scopes: ["read"]
    });
    const stored = await prisma.apiToken.findUniqueOrThrow({
      where: { id: issued.token.id }
    });

    expect(issued.plaintext).toMatch(/^phv1\./);
    expect(stored.secretHash).not.toContain(issued.plaintext);
    expect(JSON.stringify(await listApiTokens())).not.toContain(
      issued.plaintext
    );
    expect(
      await verifyApiBearer(`Bearer ${issued.plaintext}`, "read")
    ).toMatchObject({ tokenId: issued.token.id, scopes: ["read"] });
  });

  it("rejects malformed, unknown, revoked, expired, and insufficient-scope tokens", async () => {
    await bootstrapOwner("correct horse battery staple");
    const readOnly = await createApiToken({ name: "Reader", scopes: ["read"] });

    await expect(verifyApiBearer("Basic abc", "read")).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
    await expect(
      verifyApiBearer(
        "Bearer phv1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "read"
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      verifyApiBearer(`Bearer ${readOnly.plaintext}`, "write")
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SCOPE" });

    await revokeApiToken(readOnly.token.id);
    await expect(
      verifyApiBearer(`Bearer ${readOnly.plaintext}`, "read")
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const expired = await createApiToken({
      name: "Expired",
      scopes: ["read", "write"],
      expiresAt: new Date(0)
    });
    await expect(
      verifyApiBearer(`Bearer ${expired.plaintext}`, "read")
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
