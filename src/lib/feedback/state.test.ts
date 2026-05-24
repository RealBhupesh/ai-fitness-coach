import { describe, expect, it } from "vitest";
import { advanceFeedbackState, buildIssueSignature, createFeedbackState, type FeedbackCue } from "@/lib/feedback/state";

function warningCue(message: string): FeedbackCue {
  return {
    message,
    severity: "warning",
    source: "rule_engine",
    signature: buildIssueSignature({ severity: "warning", message, channel: "bicep_curl", side: "left" }),
  };
}

function criticalCue(message: string): FeedbackCue {
  return {
    message,
    severity: "critical",
    source: "rule_engine",
    signature: buildIssueSignature({ severity: "critical", message, channel: "squat", side: "body" }),
  };
}

describe("feedback state engine", () => {
  it("emits a warning only after the issue is stable, then suppresses repeats inside cooldown", () => {
    let state = createFeedbackState();
    const cue = warningCue("Left elbow drifting forward.");
    let emittedFrames = 0;

    for (let frame = 1; frame <= 8; frame += 1) {
      const decision = advanceFeedbackState(state, cue, { now: frame * 100, confidence: 0.9 });
      state = decision.nextState;
      if (decision.shouldEmit) emittedFrames += 1;
    }

    expect(emittedFrames).toBe(1);

    const suppressed = advanceFeedbackState(state, cue, { now: 2_000, confidence: 0.92 });
    expect(suppressed.shouldEmit).toBe(false);

    const repeated = advanceFeedbackState(suppressed.nextState, cue, { now: 12_500, confidence: 0.92 });
    expect(repeated.shouldEmit).toBe(true);
    expect(repeated.reason).toBe("repeat_cooldown");
  });

  it("does not emit non-critical cues when confidence is too low", () => {
    let state = createFeedbackState();
    const cue = warningCue("Torso swinging to start the curl.");

    for (let frame = 1; frame <= 10; frame += 1) {
      const decision = advanceFeedbackState(state, cue, { now: frame * 120, confidence: 0.42 });
      state = decision.nextState;
      expect(decision.shouldEmit).toBe(false);
    }
  });

  it("emits a critical cue immediately the first time it appears", () => {
    const decision = advanceFeedbackState(createFeedbackState(), criticalCue("Stop and reset your stance."), { now: 0, confidence: 0.9 });

    expect(decision.shouldEmit).toBe(true);
    expect(decision.reason).toBe("safety");
  });

  it("emits a new stable cue when the active issue changes", () => {
    let state = createFeedbackState();
    const first = warningCue("Left elbow drifting forward.");
    const second = warningCue("Left wrist folding under load.");

    for (let frame = 1; frame <= 7; frame += 1) {
      state = advanceFeedbackState(state, first, { now: frame * 120, confidence: 0.9 }).nextState;
    }

    let emitted = false;
    for (let frame = 8; frame <= 15; frame += 1) {
      const decision = advanceFeedbackState(state, second, { now: frame * 120, confidence: 0.9 });
      state = decision.nextState;
      emitted ||= decision.shouldEmit;
    }

    expect(emitted).toBe(true);
    expect(state.lastEmittedSignature).toBe(second.signature);
  });
});
