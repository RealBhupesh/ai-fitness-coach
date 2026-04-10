---
name: accurate-workout-feedback
overview: Redesign the live workout feedback pipeline to be posture-accurate, less repetitive, and state-aware, with robust confidence gating and anti-spam cue delivery for bicep curls and squats first.
todos:
  - id: feedback-state-engine
    content: Implement issue-signature based feedback state machine in PoseAnalyzer with stability and cooldown thresholds
    status: pending
  - id: metric-confidence-gating
    content: Add per-metric confidence validity in pose confidence/exercise analyzers and block unreliable metrics from emitting corrections
    status: pending
  - id: canonical-phase-fsm
    content: Unify bicep/squat phase logic with hysteresis and minimum dwell time and use it for both rep counting and cueing
    status: pending
  - id: posture-metric-hardening
    content: Refine bicep/squat metric formulas and thresholds to reduce false positives and improve mechanic-specific cues
    status: pending
  - id: llm-novelty-trigger
    content: Trigger /api/coach/feedback on meaningful state transitions and update coach prompt to avoid synthetic rephrasing spam
    status: pending
  - id: voice-ui-calm-mode
    content: Add semantic dedupe and calmer primary-cue presentation for voice and on-screen feedback
    status: pending
  - id: accuracy-regression-tests
    content: Add focused tests/fixtures for jitter, rep counting stability, cue repetition suppression, and confidence pause behavior
    status: pending
isProject: false
---

# Accurate Workout Feedback Plan

## Goal
Make workout feedback feel genuinely coach-like: posture-specific, trustworthy, and non-irritating. Prioritize bicep curls and squats as the core quality baseline, then generalize.

## Current Failure Pattern
- Live cueing is frame-driven and can chatter when metrics fluctuate.
- Duplicate suppression is mostly exact-text based, so semantically repeated advice still spams.
- LLM feedback is timer-triggered instead of state-change-triggered.
- Demo/low-confidence states can still surface generic cues too often.
- Rep counting and analysis phases are not fully unified for robust transitions.

## Target Behavior
- Feedback triggers only on meaningful state changes (not every frame).
- Confidence-aware metric validity prevents fake/low-trust posture calls.
- Cues are prioritized (safety > form > improvement > praise) with cooldowns and novelty checks.
- LLM is used as an enhancer, not the primary real-time source.
- Session recap maps directly to observed metric trends and repeated mistakes.

## Implementation Plan

### 1) Build a feedback-state engine (anti-spam core)
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx](g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx), add a `feedbackState` layer that computes:
  - `issueSignature` (normalized key of top issue + side + severity)
  - `lastIssueChangeAt`
  - `consecutiveFramesInIssue`
  - `lastSpokenSignatureAt`
- Emit cues only when one of these is true:
  - safety escalates
  - issue signature changes and is stable for N frames
  - cooldown elapsed and confidence is high
- Replace direct `setFeedback(...)` paths (including rep message path) with one unified `emitCue(...)` pipeline.

### 2) Introduce metric-level confidence validity
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\confidence.ts](g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\confidence.ts) and [g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\exercises.ts](g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\exercises.ts):
  - Add per-metric landmark confidence checks.
  - Mark low-confidence metrics as `unreliable` instead of scoring them harshly.
  - Prevent `unreliable` metrics from driving corrective feedback.
- Keep global gate for session readiness, but do not derive posture mistakes from noisy landmarks.

### 3) Unify rep phase + analysis phase with hysteresis
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\exercises.ts](g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\exercises.ts):
  - Create canonical phase state machines for `bicep_curl` and `squat`.
  - Add hysteresis bands and minimum dwell time per phase.
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx](g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx):
  - Use this same phase source for both rep counting and live feedback.

### 4) Upgrade bicep/squat posture metrics to reduce false cues
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\exercises.ts](g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\pose\exercises.ts):
  - Bicep: tighten elbow-drift detection with side-aware normalization and temporal smoothing.
  - Bicep: separate “top squeeze missing” vs “incomplete extension” cues.
  - Squat: improve depth + torso + symmetry checks with stronger gating and safer thresholds.
- Ensure each correction maps to one concrete body mechanic and one concise fix action.

### 5) Switch LLM coach trigger to novelty-based
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx](g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx):
  - Call `/api/coach/feedback` only on meaningful transitions (new issue signature, major score drop, phase milestone), not fixed timers alone.
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\ai\coach.ts](g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\ai\coach.ts):
  - Remove prompt pressure to “vary phrasing” when issue unchanged.
  - Require one actionable cue tied to detected issue key.

### 6) Improve voice and UI calmness
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\feedback\voice.ts](g:\@final year project\ai-fitness-dance-diet-coach-main\src\lib\feedback\voice.ts):
  - Add semantic dedupe using normalized issue signatures.
  - Longer cooldown for repeated non-critical cues.
- In [g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx](g:\@final year project\ai-fitness-dance-diet-coach-main\src\components\PoseAnalyzer.tsx):
  - Show one primary cue + optional secondary note, never rotating multiple warnings rapidly.

### 7) Add targeted calibration + test protocol for accuracy
- Add deterministic fixtures for bicep/squat landmark sequences in pose tests.
- Verify:
  - no rep overcounting under jitter
  - no repeated identical cue spam
  - cue changes only when issue changes
  - confidence loss pauses posture judgments cleanly
- Run existing TS/lint/test checks and add focused regression tests around the feedback-state engine.

## Rollout Strategy
- Phase A (quick win): anti-spam + novelty-trigger + unified cue pipeline.
- Phase B: metric-confidence and phase-state upgrades for curls/squats.
- Phase C: expand to remaining exercises and dance with the same architecture.

## Success Criteria
- During a 2-3 minute set, repeated identical/non-novel cues drop significantly.
- Users receive issue-specific corrections tied to current posture state.
- Rep counting and phase transitions remain stable under noisy tracking.
- LLM cues read as contextual refinements, not repetitive generic lines.