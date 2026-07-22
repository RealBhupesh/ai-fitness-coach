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

  const hasLocalhostOrigin = values.some((value) => /localhost|127\.0\.0\.1/i.test(value));
  return hasLocalhostOrigin ? [...values, ...localDevOrigins] : values;
}

export function getAppBaseUrl() {
  return process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
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
  const explicit = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE ?? process.env.ENABLE_DEMO_MODE;
  if (flagEnabled(explicit)) return true;
  if (flagDisabled(explicit)) return false;
  return true;
}

export function isClerkAuthEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function validateServerEnv() {
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  if (
    process.env.NODE_ENV === "production" &&
    process.env.BETTER_AUTH_SECRET &&
    (process.env.BETTER_AUTH_SECRET === "your-secret-key-change-in-production" ||
      process.env.BETTER_AUTH_SECRET === "replace-with-a-long-random-secret" ||
      process.env.BETTER_AUTH_SECRET.length < 32)
  ) {
    invalid.push("BETTER_AUTH_SECRET");
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    warnings.push("Better Auth secret not set; demo fallback secret will be used");
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

export function describeServerEnvState(state = validateServerEnv()) {
  const problems = [
    state.missing.length > 0 ? `missing: ${state.missing.join(", ")}` : "",
    state.invalid.length > 0 ? `invalid: ${state.invalid.join(", ")}` : "",
  ].filter(Boolean);

  return problems.length > 0 ? problems.join("; ") : "configured";
}
