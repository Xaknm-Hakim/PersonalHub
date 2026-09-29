import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const transactionLifetimeMs = 10 * 60 * 1000;
const invalidTransaction =
  "Google authorization transaction is invalid or expired.";

type OAuthPayload = {
  state: string;
  codeVerifier: string;
  ownerSessionId: string;
  expiresAt: number;
};

export function deriveOAuthTransactionSigningKey(encodedEncryptionKey: string) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encodedEncryptionKey))
    throw new Error(invalidTransaction);
  const key = Buffer.from(encodedEncryptionKey, "base64");
  if (key.length !== 32) throw new Error(invalidTransaction);
  return Buffer.from(
    hkdfSync(
      "sha256",
      key,
      Buffer.from("personalhub-integration-v1"),
      Buffer.from("google-oauth-transaction-signing"),
      32
    )
  ).toString("base64url");
}

export function googleOAuthStateMatches(expected: string, actual: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sign(encoded: string, signingKey: string) {
  return createHmac("sha256", signingKey).update(encoded).digest("base64url");
}

export function createGoogleOAuthTransaction(
  signingKey: string,
  ownerSessionId: string,
  now = Date.now()
) {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const payload: OAuthPayload = {
    state,
    codeVerifier,
    ownerSessionId,
    expiresAt: now + transactionLifetimeMs
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    state,
    codeChallenge: createHash("sha256")
      .update(codeVerifier)
      .digest("base64url"),
    cookieValue: `${encoded}.${sign(encoded, signingKey)}`
  };
}

export function parseGoogleOAuthTransaction(
  cookieValue: string,
  signingKey: string,
  now = Date.now()
): OAuthPayload {
  try {
    const [encoded, signature, extra] = cookieValue.split(".");
    if (!encoded || !signature || extra) throw new Error(invalidTransaction);
    const expected = Buffer.from(sign(encoded, signingKey));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw new Error(invalidTransaction);
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<OAuthPayload>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.ownerSessionId !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !/^[A-Za-z0-9_-]{40,}$/.test(parsed.state) ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(parsed.codeVerifier) ||
      !/^[A-Za-z0-9_-]{1,191}$/.test(parsed.ownerSessionId) ||
      parsed.expiresAt < now
    )
      throw new Error(invalidTransaction);
    return parsed as OAuthPayload;
  } catch {
    throw new Error(invalidTransaction);
  }
}

export function googleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scope,
    access_type: "offline",
    prompt: "consent",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256"
  }).toString();
  return url;
}
