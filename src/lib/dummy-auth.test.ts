import { afterEach, describe, expect, it } from "vitest";
import { buildDemoProfile, getDemoProfileFromCookie, hasDemoCookie } from "@/lib/dummy-auth";

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

describe("dummy auth demo profile persistence", () => {
  it("preserves submitted demo profile fields when stored in a cookie", () => {
    const initial = buildDemoProfile({
      name: "Chinmayee",
      goals: ["muscle_gain", "mobility"],
      dietaryPrefs: ["vegetarian"],
      onboardingCompleted: true,
      age: 28,
    });

    const cookieHeader = `fitcoach_demo=1; fitcoach_demo_profile=${encodeURIComponent(JSON.stringify(initial))}`;
    const restored = getDemoProfileFromCookie(cookieHeader);

    expect(restored).toMatchObject({
      name: "Chinmayee",
      goals: ["muscle_gain", "mobility"],
      dietaryPrefs: ["vegetarian"],
      onboardingCompleted: true,
      age: 28,
    });
  });

  it("falls back to a default demo profile when optional arrays are omitted", () => {
    const restored = buildDemoProfile({ name: "Demo Athlete" });

    expect(restored.goals).toEqual([]);
    expect(restored.dietaryPrefs).toEqual([]);
    expect(restored.injuries).toEqual([]);
    expect(restored.onboardingCompleted).toBe(false);
  });

  it("rejects demo cookies in production even when requested", () => {
    setNodeEnv("production");
    delete process.env.ENABLE_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE;

    expect(hasDemoCookie("fitcoach_demo=1")).toBe(false);

    process.env.ENABLE_DEMO_MODE = "false";
    expect(hasDemoCookie("fitcoach_demo=1")).toBe(false);
  });
});
