import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptIntegrationCredential,
  encryptIntegrationCredential
} from "@/services/integrations/credential-crypto";

const key = randomBytes(32).toString("base64");
const context = { integrationId: "integration-1", provider: "google" };

describe("integration credential encryption", () => {
  it("round trips with randomized AES-GCM envelopes", () => {
    const first = encryptIntegrationCredential("refresh-secret", key, context);
    const second = encryptIntegrationCredential("refresh-secret", key, context);
    expect(first).not.toBe(second);
    expect(decryptIntegrationCredential(first, key, context)).toBe(
      "refresh-secret"
    );
    expect(first).not.toContain("refresh-secret");
  });

  it("rejects tampering, wrong associated data, malformed envelopes, and invalid keys safely", () => {
    const encrypted = encryptIntegrationCredential(
      "refresh-secret",
      key,
      context
    );
    const ciphertextTampered = encrypted.split(".");
    ciphertextTampered[3] = `${ciphertextTampered[3].slice(0, -2)}AA`;
    const tagTampered = encrypted.split(".");
    tagTampered[2] = `${tagTampered[2].slice(0, -2)}AA`;
    for (const operation of [
      () =>
        decryptIntegrationCredential(
          ciphertextTampered.join("."),
          key,
          context
        ),
      () => decryptIntegrationCredential(tagTampered.join("."), key, context),
      () =>
        decryptIntegrationCredential(encrypted, key, {
          ...context,
          integrationId: "other"
        }),
      () =>
        decryptIntegrationCredential(encrypted, key, {
          ...context,
          provider: "other"
        }),
      () => decryptIntegrationCredential("not-an-envelope", key, context),
      () =>
        decryptIntegrationCredential(
          encrypted.replace(/^v1\./, "v2."),
          key,
          context
        ),
      () => decryptIntegrationCredential(encrypted, "bad-key", context)
    ]) {
      expect(operation).toThrowError("Integration credential is unavailable.");
    }
  });
});
