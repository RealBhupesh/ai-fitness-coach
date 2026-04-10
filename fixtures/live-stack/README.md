# Live Stack Fixture Protocol

This folder is the landing zone for deterministic replay fixtures used by the live fitness stack.

## Purpose

The runtime now has a replay harness in:
- `src/lib/pose/replay.ts`

Use it to run recorded landmark fixtures through the same:
- frame-quality gating
- phase tracking
- rule-based feedback
- post-set analysis

That lets you regression-test the live stack without a real camera session.

## Recommended fixture shape

Store JSON files with:

```json
{
  "exerciseId": "squat",
  "injuries": [],
  "frames": [
    {
      "timestampMs": 0,
      "fps": 24,
      "brightness": 82,
      "motion": 1.4,
      "landmarks": [],
      "worldLandmarks": []
    }
  ]
}
```

## Benchmark capture protocol

Target first benchmark set:
- 8-12 subjects
- desktop webcam
- Chrome-class browser

Per exercise:
- 1 clean set
- 2 flawed sets using common mistakes
- 3 adverse-condition captures:
  - low light
  - partial crop
  - wrong angle

Production exercises:
- squat
- bicep curl
- push-up
- lunge
- jumping jack
- plank

## Acceptance targets

- rep-count error at most 1 rep off per 30 clean reps
- false critical safety cues below 1 per minute on clean-form sets
- cue latency below 800 ms after a stable issue
- recovery after temporary tracking loss under 1 second without false rep increments

## Operational rule

When a real camera QA session exposes a failure, add a minimal fixture that reproduces it here and cover it with a Vitest replay test.
