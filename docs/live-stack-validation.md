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

## Research-grade posture benchmark lab

Use the benchmark lab before claiming the posture coach is state-of-the-art.

1. Build a labeled benchmark fixture from public MediaPipe landmark rows or local laptop-webcam captures.
2. Run:

```bash
npm run ml:benchmark -- --input fixtures/posture-benchmark.json --output reports/posture-benchmark.md
```

3. Review:
- accuracy and macro F1
- confusion matrix by mistake class
- average inference latency
- dataset provenance and limitations

Benchmark fixture shape:

```json
{
  "manifest": {
    "name": "Public squat benchmark",
    "sources": ["Kaggle MediaPipe 33-landmark exercise rows"],
    "sampleCount": 2,
    "subjectCount": 1,
    "captureDevice": "public dataset mixed cameras",
    "labelProtocol": "rubric labels mapped to posture mistake classes"
  },
  "samples": [
    {
      "id": "sample-1",
      "exerciseId": "squat",
      "expected": "knee_collapse",
      "frames": [
        { "timestampMs": 0, "landmarks": [] }
      ]
    }
  ]
}
```

Limit: public-data results are research evidence only. Local laptop-webcam validation is still required, and this app must not be described as a medical device.
