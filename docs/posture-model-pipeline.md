# Public-data posture model pipeline

Current status: pretrained MediaPipe locates joints; handwritten scorecards measure movement. The heuristic posture evaluator has no training dataset and no calibrated confidence. No learned artifact is included in the production bundle.

## Data admission

Only public sources with documented access and licensing terms are allowed. Research permission does not establish permission to distribute trained weights in a public app. [Fitness-AQA](https://github.com/ParitoshParmar/Fitness-AQA) is noncommercial and covers back squat, overhead press, and barbell row; do not use it as a curl source or production artifact without appropriate rights.

Keep raw datasets, manifests, prepared features, and research artifacts under ignored `datasets/` or `reports/` directories. Never place research artifacts under `public/`.

A source manifest must include:

```json
{
  "synthetic": false,
  "labelProtocol": "Published fault labels and their annotation definitions",
  "subjects": ["dataset-id:participant-01"],
  "exerciseVariants": {"squat": ["bodyweight_squat"]},
  "labelDefinitions": {"squat_depth": "Exact published definition of the positive fault label"},
  "recordings": [{
    "sourceId": "dataset-id", "videoId": "dataset-id:video-01",
    "subjectIds": ["dataset-id:participant-01"],
    "exerciseVariants": {"squat": ["bodyweight_squat"]}
  }],
  "sources": [{
    "id": "dataset-id", "type": "public",
    "url": "https://dataset-owner.example/dataset",
    "license": "Exact published license or usage agreement",
    "deploymentPermitted": false, "permittedUses": ["research"],
    "rightsEvidence": "Reference to reviewed terms; fill only when verified"
  }]
}
```

Input JSONL: one continuously labeled clip per row, with `sourceId`, `subjectId`, `videoId`, `exerciseId` (`squat` or `bicep_curl`), `exerciseVariant`, `faults`, and `frames`. Each frame contains `timestampMs`, the image `aspectRatio` (width/height), and 33 MediaPipe landmarks with finite coordinates and visibility. Split clips at annotation changes; never assign a video-level fault to clean intervals.

Supported labels: squat depth, knee collapse, torso fold, hip shift, curl elbow drift, shoulder hike, and incomplete range. Train only genuine labels actually available in admitted sources. Wrist fold is unavailable in the rule coach and is excluded from temporal-v2 learned artifacts: these features do not measure hand orientation. Supporting it requires a new feature version, genuine labels, and representative device validation.

## Extract public recordings locally

Install Chromium with `npx playwright install chromium`. Create `datasets/video-clips.json` as an array of continuously labeled clips. `videoPath` is relative to this JSON file (absolute paths also work):

```json
[{
  "sourceId": "dataset-id", "subjectId": "dataset-id:participant-01",
  "videoId": "dataset-id:video-01", "exerciseId": "squat",
  "exerciseVariant": "bodyweight_squat", "faults": ["squat_depth"],
  "videoPath": "recordings/video-01.mp4", "startMs": 1000, "endMs": 5000
}]
```

The manifest must identify this source, participant, recording, exercise variant, permitted research use, and genuine fault definitions before extraction. No dataset is admitted by this example.

```sh
npm run ml:extract -- --input datasets/video-clips.json --manifest datasets/manifest.json --output datasets/clips.jsonl --fps 10
```

The extractor serves only the listed files and model assets over loopback, decodes MP4/WebM locally, and uses the same classic MediaPipe worker. It releases each frame and closes the browser/server. It records sampled media timestamps, SDK/browser versions, model checksum, and synthetic provenance. Frames without a detected pose get zero visibility and are excluded from usable training windows. Seeking uses browser-decoded `video.currentTime`; validate timestamp precision against the recording before timing-sensitive experiments.

Limits: 5,000 clips, five minutes per continuously labeled clip, and 256 MiB of output per batch. Outputs are created exclusively; existing files are never overwritten. Split larger jobs into batches, then combine all landmark records before assigning participant/video splits. Raw video and landmarks stay in ignored dataset directories and are never sent to app telemetry.

`--fixture` accepts only explicitly marked synthetic decoder fixtures. Their marker is retained through feature preparation; training rejects them even if the enclosing manifest is incorrectly marked nonsynthetic. Synthetic fixtures exercise video processing, not form-model training.

## Prepare, train, evaluate

```sh
npm run ml:prepare -- --input datasets/clips.jsonl --output reports/features.jsonl
npm run ml:train -- --input reports/features.jsonl --manifest datasets/manifest.json --exercise squat --output reports/squat-research.json --purpose research
```

Preparation assigns connected participant/video groups before generating overlapping two-second windows, with a 500 ms stride. This uses group separation as described in the [scikit-learn grouped splitting documentation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupShuffleSplit.html); the implementation uses a deterministic group hash. The rule baseline uses the exercise phase tracker and a one-second trailing window, matching runtime rule inputs. Training verifies source membership, feature schema, and group separation. Normalization is fitted on training data only. Per-fault logistic classifiers train on CPU, sigmoid calibration fits on validation data, thresholds select on validation data, and test results remain separate.

Artifacts include feature order/version, normalization, weights, calibration, thresholds, source provenance, manifest and training-code hashes, independent subject/video counts, group hash, per-fault precision/support, confusion counts, F1, calibration error, and baseline comparison. Reports include reproducible percentile bootstrap intervals for per-fault precision, F1, and F1 difference from the rules, resampling connected participant/video groups. Fewer than ten groups are marked limited; one group yields no interval. These are uncertainty estimates for the observed groups, not webcam validity guarantees. All-correct samples can yield narrow intervals despite inadequate coverage, and undefined precision draws are scored as zero. Review independent sample counts, group coverage, and limitations before promotion.

Adjacent windows are correlated: report independent subject/video counts and do not interpret window count as independent sample count. Unsupported or rare labels require more data; do not fabricate them.

For a deployable artifact, use `--purpose deployment` only after the manifest proves deployment rights. It remains unpromoted: all physical-device evidence flags default false.

## Shadow and promotion

Copy an admitted artifact to `public/posture-models/`, enable its exercise entry in `manifest.json`, and set `NEXT_PUBLIC_LEARNED_POSTURE_MODE=shadow`. Shadow outputs are evidence only and cannot alter live cues.

Live requires macro-F1 ≥0.85, no baseline regression, precision ≥0.90 per enabled fault, calibration error ≤0.10, at least 100 positive test windows per fault and ten test subjects, and documented camera validation on laptop, low-tier Android, and mid-tier Android. Window support alone is insufficient: review uncertainty using subjects/videos as sampling units and record limitations.

Model artifacts must match the feature order, exercise labels, finite weights, and deployment provenance. Bad/missing artifacts stay disabled. Promotion additionally requires representative webcam form validation; public scores do not establish it. Without that evidence, keep shadow mode. `live` enables local advisory fault cues through the existing stability/debounce rules and never bypasses camera gates or critical measured cues.

Temporal-v2 features use isotropic height units: x and z are multiplied by image width/height while y is unchanged. Runtime phase/scoring and offline extraction use this same conversion; drawing retains the original normalized points. Use aspectRatio 1 only for square imagery or explicitly isotropic precomputed coordinates. Earlier temporal-v1 weights are incompatible and rejected.

Camera processing stays in a worker with one frame in flight, following [MediaPipe guidance on blocking inference calls](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js). `npm run worker:build` emits the classic browser worker with esbuild before development, production builds, and browser tests. When invoking the Next.js CLI directly, run this command first. Raw frames are released after inference. Runtime session saves retain model versions and measured aggregates, not video or landmark sequences. Aggregate clean/confidence scores are not jointly calibrated probabilities; individual learned fault probabilities are presented separately.
