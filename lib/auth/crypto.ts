import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual
} from "node:crypto";
const passwordKeyLength = 64;
const scryptCost = 32768;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const scryptMaxMemory = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      length,
      {
        N: scryptCost,
        r: scryptBlockSize,
        p: scryptParallelization,
        maxmem: scryptMaxMemory
      },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, passwordKeyLength);
  return [
    "scrypt",
    "v=1",
    `N=${scryptCost},r=${scryptBlockSize},p=${scryptParallelization}`,
    salt.toString("base64url"),
    key.toString("base64url")
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encoded: string
): Promise<boolean> {
  try {
    const [algorithm, version, parameters, encodedSalt, encodedKey, extra] =
      encoded.split("$");
    if (
      algorithm !== "scrypt" ||
      version !== "v=1" ||
      parameters !==
        `N=${scryptCost},r=${scryptBlockSize},p=${scryptParallelization}` ||
      !encodedSalt ||
      !encodedKey ||
      extra
    )
      return false;
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedKey, "base64url");
    if (salt.length !== 16 || expected.length !== passwordKeyLength)
      return false;
    const actual = await deriveKey(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return `phs1.${randomBytes(32).toString("base64url")}`;
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateApiToken() {
  const id = randomBytes(12).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  return { id, secret, plaintext: `phv1.${id}.${secret}` };
}

export function parseApiToken(
  token: string
): { id: string; secret: string } | null {
  const match = /^phv1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{43})$/.exec(token);
  return match ? { id: match[1], secret: match[2] } : null;
}

export function safelyEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right))
    return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
