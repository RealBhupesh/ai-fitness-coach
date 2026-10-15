# Beta release evidence

Repository implementation does not by itself establish release readiness. Record evidence for this exact revision before opening the 50-account beta.

| Gate | Required evidence |
| --- | --- |
| Engineering | Passing lint, typecheck, unit/model tests, production build, migration checks, and CI |
| Data | Fresh migration, upgrade preserving legacy data, concurrent retry/conflict tests, transaction rollback, cross-user denial, export/deletion, successful encrypted backup restoration |
| Services | Verified Clerk lifecycle, identity collision/link flow, real Upstash quotas/outage behavior, staging/production separation, cron retries, spending alerts |
| Full app | Signup, onboarding, all exercise routes, packaged dance tutorial/practice, plans, nutrition logs, progress, achievements, recovery, settings, session reports and exports |
| Camera | Laptop GPU and CPU paths; low- and mid-tier Android Chrome; permission denial, crop, bad light, wrong view, rotation, background/resume, camera loss, GPU failure and model loading failure |
| Rep counting | ≤1 error per 30 clean reps for each rep-based exercise; no duplicate reps after interruption |
| Feedback | Stable local cue within 800 ms; tracking recovery within 1 s after usable input returns; measure false cues on clean form |
| Holds/dance | Verified hold durations and packaged phrase timing; claim scope restricted to the starter routine |
| Learned models | Separate artifact promotion report and representative camera evidence; otherwise disabled or shadow |

Use synthetic replay fixtures for regression checks and actual devices for performance and validity. Device emulation and fake camera streams do not replace physical Android measurements. Validation sessions need not become training data; the training-source restriction remains public datasets only.

Record device/browser versions, capture setup, independent subjects/videos, exercise variants, sample counts, errors, cue delays, FPS, failures, and limitations. Capture summary metrics rather than uploading participant video. Do not claim validated accuracy for camera/body conditions absent from evidence.

Operator defaults: adults 18+, English, 50 accounts, reminder delivery unavailable, payments disabled, learned models disabled. Existing accounts are preserved until inventory and identity migration are complete. Public release stays closed while required service or physical-device evidence is missing.
