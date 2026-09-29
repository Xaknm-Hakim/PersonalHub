type ServerEnvironment = Record<string, string | undefined>;

export function validateServerEnvironment(
  env: ServerEnvironment = process.env
) {
  const value = env.PERSONALHUB_DATABASE_URL;
  if (!value) throw new Error("PERSONALHUB_DATABASE_URL is required.");
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error("PERSONALHUB_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol))
    throw new Error("PERSONALHUB_DATABASE_URL must use PostgreSQL.");
  if (
    env.NODE_ENV === "production" &&
    (!databaseUrl.username || !databaseUrl.password)
  )
    throw new Error("Production PostgreSQL credentials must not be empty.");
  if (
    env.PERSONALHUB_TRUST_PROXY !== undefined &&
    !["true", "false"].includes(env.PERSONALHUB_TRUST_PROXY)
  )
    throw new Error("PERSONALHUB_TRUST_PROXY must be true or false.");
  return {
    databaseUrl: value,
    trustProxy: env.PERSONALHUB_TRUST_PROXY === "true"
  };
}

function requireIntegrationValue(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required for Google integration.`);
  return value;
}

export function googleIntegrationEnv(
  environment: ServerEnvironment = process.env
) {
  const clientId = requireIntegrationValue(
    "PERSONALHUB_GOOGLE_CLIENT_ID",
    environment.PERSONALHUB_GOOGLE_CLIENT_ID
  );
  const clientSecret = requireIntegrationValue(
    "PERSONALHUB_GOOGLE_CLIENT_SECRET",
    environment.PERSONALHUB_GOOGLE_CLIENT_SECRET
  );
  const encryptionKey = requireIntegrationValue(
    "PERSONALHUB_INTEGRATION_ENCRYPTION_KEY",
    environment.PERSONALHUB_INTEGRATION_ENCRYPTION_KEY
  );
  const publicOrigin = requireIntegrationValue(
    "PERSONALHUB_PUBLIC_ORIGIN",
    environment.PERSONALHUB_PUBLIC_ORIGIN
  );
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(publicOrigin);
  } catch {
    throw new Error(
      "PERSONALHUB_PUBLIC_ORIGIN must be an absolute HTTPS origin."
    );
  }
  if (
    parsedOrigin.protocol !== "https:" ||
    parsedOrigin.origin !== publicOrigin ||
    parsedOrigin.username ||
    parsedOrigin.password
  )
    throw new Error(
      "PERSONALHUB_PUBLIC_ORIGIN must be an absolute HTTPS origin."
    );
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(encryptionKey) ||
    Buffer.from(encryptionKey, "base64").length !== 32
  )
    throw new Error(
      "PERSONALHUB_INTEGRATION_ENCRYPTION_KEY must encode exactly 32 bytes."
    );
  return { clientId, clientSecret, encryptionKey, publicOrigin };
}

export function googleIntegrationIsConfigured(
  environment: ServerEnvironment = process.env
) {
  try {
    googleIntegrationEnv(environment);
    return true;
  } catch {
    return false;
  }
}
