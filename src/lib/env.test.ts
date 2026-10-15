import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoModeEnabled, validateServerEnv, getTrustedOrigins } from "@/lib/env";
afterEach(() => vi.unstubAllEnvs());
describe("production gates", () => {
  it("requires explicit demo flags and always disables production demo auth", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("ENABLE_DEMO_MODE", "false"); vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "false");
    expect(isDemoModeEnabled()).toBe(false);
    vi.stubEnv("ENABLE_DEMO_MODE", "true"); expect(isDemoModeEnabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "production"); expect(isDemoModeEnabled()).toBe(false); expect(validateServerEnv().invalid).toContain("ENABLE_DEMO_MODE");
  });
  it("rejects incomplete production configuration", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const result = validateServerEnv(); expect(result.ok).toBe(false); expect(result.missing).toContain("DATABASE_URL"); expect(result.missing).toContain("UPSTASH_REDIS_REST_TOKEN");
  });
  it("rejects published development secrets in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const secret of ["fitcoach-demo-only-fallback-secret-for-vercel-preview", "replace-with-a-random-development-secret-at-least-32-characters"]) {
      vi.stubEnv("BETTER_AUTH_SECRET", secret);
      expect(validateServerEnv().invalid).toContain("BETTER_AUTH_SECRET");
    }
  });
  it("does not expand localhost origins in production", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"); vi.stubEnv("TRUSTED_ORIGINS", "http://localhost:3000");
    expect(getTrustedOrigins()).not.toContain("http://localhost:3001");
  });
});
