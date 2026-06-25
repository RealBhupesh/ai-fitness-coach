import { afterEach, describe, expect, it } from "vitest";
import { describeServerEnvState, isDemoModeEnabled, validateServerEnv } from "@/lib/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function setNodeEnv(value: NodeJS.ProcessEnv["NODE_ENV"]) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

describe("environment production gates", () => {
  it("enables demo mode by default outside production only", () => {
    setNodeEnv("development");
    delete process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE;
    delete process.env.ENABLE_DEMO_MODE;
    expect(isDemoModeEnabled()).toBe(true);

    setNodeEnv("production");
    expect(isDemoModeEnabled()).toBe(false);
  });

  it("allows explicit demo-mode override", () => {
    setNodeEnv("production");
    process.env.ENABLE_DEMO_MODE = "true";
    expect(isDemoModeEnabled()).toBe(true);

    process.env.ENABLE_DEMO_MODE = "false";
    process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE = "1";
    expect(isDemoModeEnabled()).toBe(true);
  });

  it("rejects placeholder production secrets", () => {
    setNodeEnv("production");
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/fitcoach";
    process.env.BETTER_AUTH_SECRET = "your-secret-key-change-in-production";

    const state = validateServerEnv();

    expect(state.ok).toBe(false);
    expect(state.invalid).toContain("BETTER_AUTH_SECRET");
    expect(describeServerEnvState(state)).toBe("invalid: BETTER_AUTH_SECRET");
  });
});
