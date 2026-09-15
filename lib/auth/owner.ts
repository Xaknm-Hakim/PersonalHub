import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  generateSessionToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword
} from "@/lib/auth/crypto";
import { logEvent } from "@/lib/logging";

const ownerId = "owner";
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const throttleWindowMs = 15 * 60 * 1000;
const throttleBlockMs = 5 * 60 * 1000;
const maximumFailures = 5;
const dummyPasswordHash = hashPassword(randomBytes(32).toString("base64url"));

export class OwnerAlreadyExistsError extends Error {
  constructor() {
    super("The owner is already configured.");
    this.name = "OwnerAlreadyExistsError";
  }
}

export function validateOwnerPassword(password: string) {
  if (password.length < 12 || password.length > 1024)
    throw new Error("Owner password must be between 12 and 1024 characters.");
}

export async function bootstrapOwner(password: string) {
  validateOwnerPassword(password);
  if (await prisma.owner.findUnique({ where: { id: ownerId } }))
    throw new OwnerAlreadyExistsError();
  const passwordHash = await hashPassword(password);
  try {
    return await prisma.owner.create({
      data: { id: ownerId, passwordHash }
    });
  } catch (error) {
    if (await prisma.owner.findUnique({ where: { id: ownerId } }))
      throw new OwnerAlreadyExistsError();
    throw error;
  }
}

async function activeThrottle(key: string, now: Date) {
  const throttle = await prisma.loginThrottle.findUnique({ where: { key } });
  return Boolean(throttle?.blockedUntil && throttle.blockedUntil > now);
}

async function recordFailure(key: string, now: Date) {
  await prisma.$transaction(async (database) => {
    const existing = await database.loginThrottle.findUnique({
      where: { key }
    });
    const inWindow =
      existing &&
      now.getTime() - existing.windowStart.getTime() < throttleWindowMs;
    const failureCount = inWindow ? existing.failureCount + 1 : 1;
    await database.loginThrottle.upsert({
      where: { key },
      create: {
        key,
        windowStart: now,
        failureCount,
        blockedUntil:
          failureCount >= maximumFailures
            ? new Date(now.getTime() + throttleBlockMs)
            : null
      },
      update: {
        windowStart: inWindow ? existing.windowStart : now,
        failureCount,
        blockedUntil:
          failureCount >= maximumFailures
            ? new Date(now.getTime() + throttleBlockMs)
            : null
      }
    });
  });
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: "INVALID_CREDENTIALS" | "RATE_LIMITED" };

export async function loginOwner(
  password: string,
  throttleKey: string
): Promise<LoginResult> {
  const now = new Date();
  if (await activeThrottle(throttleKey, now)) {
    logEvent("warn", "login_rate_limited");
    return { ok: false, reason: "RATE_LIMITED" };
  }

  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  const valid = await verifyPassword(
    password.slice(0, 1025),
    owner?.passwordHash ?? (await dummyPasswordHash)
  );
  if (!owner || password.length > 1024 || !valid) {
    await recordFailure(throttleKey, now);
    logEvent("warn", "login_failed");
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  await prisma.loginThrottle.deleteMany({ where: { key: throttleKey } });
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs);
  await prisma.session.create({
    data: {
      tokenHash: hashOpaqueToken(token),
      ownerId: owner.id,
      authVersion: owner.authVersion,
      expiresAt
    }
  });
  logEvent("info", "login_succeeded");
  return { ok: true, token, expiresAt };
}

export async function validateSessionToken(token: string) {
  if (!/^phs1\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { owner: { select: { authVersion: true } } }
  });
  if (
    !session ||
    session.expiresAt <= now ||
    session.authVersion !== session.owner.authVersion
  ) {
    if (session)
      await prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => {});
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > 60 * 60 * 1000)
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now }
    });
  return {
    id: session.id,
    ownerId: session.ownerId,
    expiresAt: session.expiresAt
  };
}

export async function revokeSession(token: string) {
  if (!token) return;
  await prisma.session.deleteMany({
    where: { tokenHash: hashOpaqueToken(token) }
  });
}

export async function ownerIsConfigured() {
  return Boolean(await prisma.owner.findUnique({ where: { id: ownerId } }));
}
