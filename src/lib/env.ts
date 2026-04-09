const DEFAULT_APP_URL = "http://localhost:3000";

export function getAppBaseUrl() {
  return process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
}

export function getTrustedOrigins() {
  const values = [
    getAppBaseUrl(),
    ...(process.env.TRUSTED_ORIGINS?.split(",") ?? []),
  ];

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
