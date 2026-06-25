# Fitness Module Readiness

This app is not claiming medical-grade or regulated clinical performance. The current target is research-grade AI coach guidance with measured evidence, explicit confidence, and production checks.

## Live Modules

| Module | Status | Runtime evidence |
| --- | --- | --- |
| Squat | Strict rep scoring + specialized scorecard + ML-assisted posture prediction | Depth, knee tracking, torso stack, hip centering, symmetry, shoulder stability, tempo |
| Bicep curl | Strict rep scoring + specialized scorecard + ML-assisted posture prediction | Elbow path, shoulder stability, torso stability, wrist stack, top finish, bottom extension, tempo, symmetry |
| Push-up | Strict rep scoring + generic measured scorecard | Depth, body line, shoulder stack, hip stability |
| Lunge | Strict rep scoring + generic measured scorecard | Front knee, torso stack, hip level, leg balance |
| Jumping jack | Strict rep scoring + generic measured scorecard | Arm reach, foot width, timing sync, landing control, symmetry |
| Plank | Hold scoring + grounded AI guidance | Body line, shoulder stack, hip level, neck position |
| Warrior | Hold scoring + grounded AI guidance | Front knee, arm line, stability, tempo |
| Dance frame | Hold/phrase scoring + dance comparator | Frame width, arm range, torso stability, knee bounce, timing, symmetry |

## Current SOTA Gap

The module system now behaves like a serious multi-exercise coach, but it is not state of the art until these are completed:

- Train and validate temporal models on labeled exercise video, not only handcrafted scorecards and seed ML.
- Report per-exercise accuracy, F1, calibration, latency, and subgroup robustness.
- Validate laptop-webcam performance across body types, clothing, lighting, camera placement, and backgrounds.
- Add expert annotation agreement for posture faults.
- Keep claims limited to AI coach guidance unless pursuing medical-device validation.
