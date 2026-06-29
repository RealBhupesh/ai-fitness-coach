import { describe, expect, it } from "vitest";
import { buildDanceCourseState, isDanceAttemptComplete, resolveDanceCourseStatus } from "@/lib/dance/course-rules";
import type { DanceRoutinePack } from "@/lib/dance/types";

const routine: DanceRoutinePack = {
  id: "starter-groove-pack",
  name: "Starter Groove",
  description: "Test routine",
  difficulty: "beginner",
  durationMs: 16000,
  bpm: 96,
  audioUrl: "/test.wav",
  thumbnailUrl: "/test.svg",
  checkpoints: [],
  segments: [
    {
      id: "open-hit",
      label: "Open Hit",
      startMs: 0,
      endMs: 8000,
      cue: "Open",
      focus: "wide frame",
      targetMetrics: { frameWidth: [50, 80], armLift: [0, 20], torsoLeanMax: 8, kneeAngle: [130, 160], symmetryMax: 8 },
      targetLandmarks: {},
    },
    {
      id: "groove-drop",
      label: "Groove Drop",
      startMs: 8000,
      endMs: 16000,
      cue: "Drop",
      focus: "soft knees",
      targetMetrics: { frameWidth: [40, 70], armLift: [0, 12], torsoLeanMax: 8, kneeAngle: [125, 155], symmetryMax: 8 },
      targetLandmarks: {},
    },
  ],
  tutorial: [
    {
      id: "open-hit-tutorial",
      segmentId: "open-hit",
      order: 1,
      title: "Open Hit",
      count: "1-2",
      teachingCue: "Open the frame.",
      practiceCue: "Hit wide.",
      commonMistake: "Too narrow.",
      correction: "Reach both wrists.",
    },
    {
      id: "groove-drop-tutorial",
      segmentId: "groove-drop",
      order: 2,
      title: "Groove Drop",
      count: "3-4",
      teachingCue: "Drop into the bounce.",
      practiceCue: "Soften knees.",
      commonMistake: "Too stiff.",
      correction: "Bounce evenly.",
    },
  ],
};

describe("dance course progress", () => {
  it("requires score and reliability before completing a lesson", () => {
    expect(isDanceAttemptComplete(80, 70)).toBe(true);
    expect(isDanceAttemptComplete(84, 64)).toBe(false);
    expect(isDanceAttemptComplete(76, 90)).toBe(false);
  });

  it("marks attempted lessons as practicing until pass rules are met", () => {
    expect(resolveDanceCourseStatus({ score: 0, reliability: 0, attempts: 0 })).toBe("not_started");
    expect(resolveDanceCourseStatus({ score: 79, reliability: 90, attempts: 2 })).toBe("practicing");
    expect(resolveDanceCourseStatus({ score: 86, reliability: 88, attempts: 1 })).toBe("completed");
  });

  it("builds next lesson and completion summary from persisted progress", () => {
    const now = new Date("2026-06-29T09:00:00.000Z");
    const state = buildDanceCourseState({
      routine,
      progressRows: [
        {
          segmentId: "open-hit",
          status: "completed",
          bestScore: 87,
          bestReliability: 79,
          attempts: 2,
          completedAt: now,
          lastAttemptAt: now,
        },
      ],
      attemptRows: [],
      leaderboard: [],
    });

    expect(state.completedLessons).toBe(1);
    expect(state.completionPercent).toBe(50);
    expect(state.nextLesson?.segmentId).toBe("groove-drop");
    expect(state.lessons[0]?.status).toBe("completed");
    expect(state.lessons[1]?.status).toBe("not_started");
  });
});
