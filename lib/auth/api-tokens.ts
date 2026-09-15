import { prisma } from "@/lib/prisma";
import {
  generateApiToken,
  hashOpaqueToken,
  parseApiToken,
  safelyEqualHex
} from "@/lib/auth/crypto";
import { AuthError } from "@/lib/auth/errors";
import { logEvent } from "@/lib/logging";

export const apiScopes = ["read", "write"] as const;
export type ApiScope = (typeof apiScopes)[number];

function unauthorized() {
  return new AuthError(
    "UNAUTHORIZED",
    401,
    "A valid bearer token is required."
  );
}

export async function createApiToken(input: {
  name: string;
  scopes: ApiScope[];
  expiresAt?: Date | null;
}) {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error("Token name is required.");
  const scopes = [...new Set(input.scopes)];
  if (!scopes.length || scopes.some((scope) => !apiScopes.includes(scope)))
    throw new Error("At least one valid token scope is required.");
  const owner = await prisma.owner.findUnique({ where: { id: "owner" } });
  if (!owner) throw new Error("The owner is not configured.");
  const generated = generateApiToken();
  const token = await prisma.apiToken.create({
    data: {
      id: generated.id,
      ownerId: owner.id,
      name,
      scopes,
      secretHash: hashOpaqueToken(generated.secret),
      expiresAt: input.expiresAt ?? null
    },
    select: {
      id: true,
      name: true,
      scopes: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true
    }
  });
  logEvent("info", "api_token_created", { tokenId: token.id });
  return { plaintext: generated.plaintext, token };
}

export async function listApiTokens() {
  return prisma.apiToken.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      scopes: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true
    }
  });
}

export async function revokeApiToken(id: string) {
  const result = await prisma.apiToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  if (result.count) logEvent("info", "api_token_revoked", { tokenId: id });
  return result.count > 0;
}

export async function verifyApiBearer(
  authorization: string | null,
  requiredScope: ApiScope
) {
  const match = authorization?.match(/^Bearer ([^ ]+)$/);
  const parsed = match ? parseApiToken(match[1]) : null;
  if (!parsed) throw unauthorized();
  const token = await prisma.apiToken.findUnique({ where: { id: parsed.id } });
  const suppliedHash = hashOpaqueToken(parsed.secret);
  if (
    !token ||
    !safelyEqualHex(suppliedHash, token.secretHash) ||
    token.revokedAt ||
    (token.expiresAt && token.expiresAt <= new Date())
  )
    throw unauthorized();
  if (!token.scopes.includes(requiredScope))
    throw new AuthError(
      "INSUFFICIENT_SCOPE",
      403,
      `The token does not have ${requiredScope} access.`
    );
  await prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() }
  });
  return {
    tokenId: token.id,
    ownerId: token.ownerId,
    scopes: token.scopes as ApiScope[]
  };
}
