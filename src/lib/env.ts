const DEFAULT_APP_URL = "http://localhost:3000";

function expandLocalDevOrigins(values: string[]) {
  const localDevOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
  ];

  const hasLocalhostOrigin = process.env.NODE_ENV !== "production" && values.some((value) => /localhost|127\.0\.0\.1/i.test(value));
  return hasLocalhostOrigin ? [...values, ...localDevOrigins] : values;
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || DEFAULT_APP_URL;
}

export function getTrustedOrigins() {
  const values = expandLocalDevOrigins([
    getAppBaseUrl(),
    ...(process.env.TRUSTED_ORIGINS?.split(",") ?? []),
  ]);

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function flagEnabled(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(value ?? "");
}

function flagDisabled(value: string | undefined) {
  return /^(0|false|no|off)$/i.test(value ?? "");
}

export function isDemoModeEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  const explicit = process.env.ENABLE_DEMO_MODE ?? process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE;
  if (flagEnabled(explicit)) return true;
  if (flagDisabled(explicit)) return false;
  return false;
}

export function isLegacyAuthEnabled() {
  return process.env.NODE_ENV !== "production" || (flagEnabled(process.env.ENABLE_LEGACY_AUTH) && flagEnabled(process.env.AUTH_MIGRATION_INVENTORIED));
}

export function isClerkAuthEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function validateServerEnv() {
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];
  if (process.env.NODE_ENV === "production") {
    for (const key of ["DATABASE_URL", "NEXT_PUBLIC_APP_URL", "TRUSTED_ORIGINS", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "CRON_SECRET"]) {
      if (!process.env[key]?.trim()) missing.push(key);
    }
    if (!flagEnabled(process.env.AUTH_MIGRATION_INVENTORIED)) invalid.push("AUTH_MIGRATION_INVENTORIED");
    if (flagEnabled(process.env.ENABLE_DEMO_MODE) || flagEnabled(process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE)) invalid.push("ENABLE_DEMO_MODE");
    if (flagEnabled(process.env.ENABLE_LEGACY_AUTH) && !process.env.BETTER_AUTH_SECRET) missing.push("BETTER_AUTH_SECRET");
    for (const key of ["NEXT_PUBLIC_APP_URL", "UPSTASH_REDIS_REST_URL"]) {
      if (!process.env[key]) continue;
      try { if (new URL(process.env[key]!).protocol !== "https:") invalid.push(key); } catch { invalid.push(key); }
    }
    for (const value of process.env.TRUSTED_ORIGINS?.split(",") ?? []) {
      try { const url = new URL(value.trim()); if (url.protocol !== "https:" || url.origin !== value.trim()) invalid.push("TRUSTED_ORIGINS"); } catch { invalid.push("TRUSTED_ORIGINS"); }
    }
    if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 32) invalid.push("CRON_SECRET");
  }
  if (process.env.DATABASE_URL && !/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL)) invalid.push("DATABASE_URL");

  if (
    process.env.NODE_ENV === "production" &&
    process.env.BETTER_AUTH_SECRET &&
    (/^(?:replace-with-|your-secret-|fitcoach-demo-only-|playwright-|ci-local-|local-validation-)/.test(process.env.BETTER_AUTH_SECRET) ||
      process.env.BETTER_AUTH_SECRET === "your-secret-key-change-in-production" ||
      process.env.BETTER_AUTH_SECRET === "replace-with-a-long-random-secret" ||
      process.env.BETTER_AUTH_SECRET.length < 32)
  ) {
    invalid.push("BETTER_AUTH_SECRET");
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    warnings.push("Legacy Better Auth secret not set");
  }

  if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_SECRET) {
    invalid.push("GOOGLE_CLIENT_SECRET");
  }
  if (!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    invalid.push("GOOGLE_CLIENT_ID");
  }
  if (!process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push("Google OAuth disabled until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured");
  }
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !process.env.CLERK_SECRET_KEY) {
    warnings.push("Clerk disabled until NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are configured");
  }
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !process.env.CLERK_SECRET_KEY) {
    invalid.push("CLERK_SECRET_KEY");
  }
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    invalid.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }
  if (!process.env.DATABASE_URL) {
    warnings.push("Database disabled; app will use demo/fallback data only");
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    warnings,
  };
}

export function assertProductionEnvironment() {
  if (process.env.NODE_ENV === "production" && !validateServerEnv().ok) throw new Error("SERVICE_NOT_CONFIGURED");
}

export function describeServerEnvState(state = validateServerEnv()) {
  const problems = [
    state.missing.length > 0 ? `missing: ${state.missing.join(", ")}` : "",
    state.invalid.length > 0 ? `invalid: ${state.invalid.join(", ")}` : "",
  ].filter(Boolean);

  return problems.length > 0 ? problems.join("; ") : "configured";
}
