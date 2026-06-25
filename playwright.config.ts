import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const useProductionBuild = /^(1|true|yes)$/i.test(process.env.PLAYWRIGHT_USE_BUILD ?? "");
const webServerEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/fitcoach",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "playwright-local-secret-at-least-32-characters",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? baseURL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
  TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS ?? baseURL,
  ENABLE_DEMO_MODE: process.env.ENABLE_DEMO_MODE ?? "false",
  NEXT_PUBLIC_ENABLE_DEMO_MODE: process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE ?? "false",
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: useProductionBuild ? `npm run build && npx next start --port ${port}` : `npx next dev --webpack --port ${port}`,
    url: baseURL,
    env: webServerEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
