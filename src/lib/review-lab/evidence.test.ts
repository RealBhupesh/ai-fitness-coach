import { describe, expect, it } from "vitest";

describe("review lab methodology", () => {
  it("exposes versioned non-medical claim boundaries", async () => {
    const { REVIEW_LAB_METHODOLOGY } = await import("@/lib/review-lab/methodology");

    expect(REVIEW_LAB_METHODOLOGY.version).toMatch(/^review-lab-/);
    expect(REVIEW_LAB_METHODOLOGY.claimBoundary).toBe("AI coach guidance, not medical diagnosis");
    expect(REVIEW_LAB_METHODOLOGY.modules.map((module) => module.id)).toEqual(["squat", "bicep_curl", "dance"]);
    expect(REVIEW_LAB_METHODOLOGY.limitations).toContain("No medical diagnosis, injury assessment, or treatment recommendation.");
  });
});
