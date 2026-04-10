# Live Stack Validation

The live fitness stack is validated in two layers:

1. Deterministic replay tests
2. Real-device camera QA

## Deterministic replay

Replay uses:
- `src/lib/pose/replay.ts`

It feeds landmark fixtures through the same core path used by the browser runtime:
- `buildTrackingFrame()`
- `evaluateConfidence()`
- `advancePhaseTracker()`
- `analyzeExercise()`
- `evaluateSafety()`
- feedback-state stability logic
- session post-set aggregation

Current automated coverage includes:
- frame-quality gating
- post-set session buffering
- replay pause/resume behavior for squat rep counting

## Manual camera QA checklist

Run this before calling the live stack release-ready:

- `squat`
  - front view
  - angled view
  - knees collapsing in
  - partial crop
- `bicep_curl`
  - clean rep
  - elbow drift
  - shoulder shrug
  - wrist collapse
- `pushup`
  - true side view
  - wrong-angle rejection
  - hip sag
- `lunge`
  - front/angled view
  - excessive front-knee travel
- `jumping_jack`
  - full-body view
  - low-light degradation
- `plank`
  - side view
  - low-confidence pause
- `dance_basic`
  - phrase timing
  - locked-knee warning
  - off-center torso warning

## Required release checks

- `npm run test`
- `npm run build`
- real camera QA on the target hardware class
- fixture added for every regression found during camera QA
