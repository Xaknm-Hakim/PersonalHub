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
