import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type CredentialContext = { integrationId: string; provider: string };
const failureMessage = "Integration credential is unavailable.";

function decodeKey(encodedKey: string) {
  try {
    if (!/^[A-Za-z0-9+/]{43}=$/.test(encodedKey))
      throw new Error(failureMessage);
    const key = Buffer.from(encodedKey, "base64");
    if (key.length !== 32) throw new Error(failureMessage);
    return key;
  } catch {
    throw new Error(failureMessage);
  }
}

function associatedData(context: CredentialContext) {
  return Buffer.from(
    `personalhub:integration:${context.integrationId}:${context.provider}:refresh-token:v1`,
    "utf8"
  );
}

export function encryptIntegrationCredential(
  plaintext: string,
  encodedKey: string,
  context: CredentialContext
) {
  if (!plaintext) throw new Error(failureMessage);
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", decodeKey(encodedKey), iv);
    cipher.setAAD(associatedData(context));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url")
    ].join(".");
  } catch {
    throw new Error(failureMessage);
  }
}

export function decryptIntegrationCredential(
  envelope: string,
  encodedKey: string,
  context: CredentialContext
) {
  try {
    const [version, encodedIv, encodedTag, encodedCiphertext, extra] =
      envelope.split(".");
    if (
      version !== "v1" ||
      !encodedIv ||
      !encodedTag ||
      !encodedCiphertext ||
      extra
    )
      throw new Error(failureMessage);
    const iv = Buffer.from(encodedIv, "base64url");
    const tag = Buffer.from(encodedTag, "base64url");
    if (iv.length !== 12 || tag.length !== 16) throw new Error(failureMessage);
    const decipher = createDecipheriv("aes-256-gcm", decodeKey(encodedKey), iv);
    decipher.setAAD(associatedData(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new Error(failureMessage);
  }
}
