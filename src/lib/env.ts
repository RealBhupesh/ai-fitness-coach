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

export function validateServerEnv() {
  const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET"].filter((key) => !process.env[key]);
  return {
    ok: missing.length === 0,
    missing,
  };
}
