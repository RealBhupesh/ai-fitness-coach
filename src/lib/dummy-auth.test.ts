import { describe, expect, it } from "vitest";
import { buildDemoProfile, getDemoProfileFromCookie } from "@/lib/dummy-auth";

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
});
