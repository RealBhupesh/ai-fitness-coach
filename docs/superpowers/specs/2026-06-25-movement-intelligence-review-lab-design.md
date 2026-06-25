# Movement Intelligence Review Lab Design

Date: 2026-06-25

## Purpose

Build a professor-facing proof layer for FitCoach AI called the **Movement Intelligence Review Lab**.

The feature should make the project easier to evaluate academically by showing not only that live posture and dance feedback works, but also why each correction was generated, what evidence supports it, and where the system refuses to make unsupported claims.

The Review Lab is centered on three flagship modules:

- **Squat** for posture, depth, knee tracking, torso stack, safety, and confidence gating.
- **Bicep curl** for clean webcam rep counting, elbow path, wrist stack, shoulder stability, and range-of-motion evidence.
- **Dance phrase** for skeleton-follow training, rhythm, phrase timing, pose similarity, and tutorial alignment.

The primary outcome is a reviewable after-session report. The live demo remains important, but the report is the main academic proof.

## Product Concept

The Review Lab turns completed live coaching sessions into structured evidence reports.

Flow:

1. A user performs a squat, curl, or dance session.
2. Existing pose and dance engines score the session.
3. The app saves structured evidence: reps or phrases, mistakes, confidence, camera quality, AI cues, and limitations.
4. A professor or reviewer opens a dashboard to inspect what happened and why each correction was generated.
5. The report can be exported or presented as a final-year-project artifact.

This is intentionally not a broad new fitness feature. It is an explainability and evaluation layer around the strongest systems already in the app.

## Screens

### Review Lab Dashboard

Route: `/review-lab`

Shows completed evidence sessions.

Each session card includes:

- Exercise or module type: squat, curl, or dance.
- Date and time.
- Overall score.
- Model or scoring confidence.
- Camera quality summary.
- Top mistake or strongest coaching insight.
- Review action.
- Export/report action.

The dashboard should make it obvious which sessions are strong enough for academic review and which were limited by camera quality or insufficient data.

### Session Evidence Report

Route: `/review-lab/[sessionId]`

This is the main professor-facing screen.

Sections:

- **Summary**: module, date, duration, reps or phrases, overall score, confidence.
- **Live Review Strip**: key timeline events and cue moments. Raw video storage is out of scope for the first version.
- **Evidence Timeline**: rep-by-rep for squat/curl, phrase-by-phrase for dance.
- **Mistake Probability Table**: likely faults with confidence and evidence source.
- **Measured Metrics**: range of motion, tempo, symmetry, posture confidence, camera quality, and relevant joint-angle evidence.
- **AI Feedback Log**: generated cues with measured evidence attached.
- **Limitations**: low confidence frames, body out of frame, camera angle issues, insufficient reps, non-medical claim boundary.
- **Methodology References**: MediaPipe landmarks, deterministic scorecards, ML posture evaluator, dance comparator, and validation status.

### Validation and Methodology Page

Route: `/review-lab/methodology`

Explains:

- What the system measures.
- How deterministic scorecards and ML-assisted scoring combine.
- What camera and landmark confidence mean.
- What the system refuses to claim.
- Dataset and public-validation status.
- Why this is AI coach guidance, not medical diagnosis.
- Future validation work required for stronger real-world claims.

This page should be written in plain academic language so a professor can evaluate the methodology without reading source code.

## Data Model

Do not store raw video in the first version. It is heavy, privacy-sensitive, and unnecessary for the initial proof layer.

Store structured evidence snapshots connected to existing session data.

Core review evidence fields:

- `sessionId`
- `module`: `squat | curl | dance`
- `overallScore`
- `modelConfidence`
- `cameraQuality`
- `topMistakes`
- `repEvidence` or `phraseEvidence`
- `metricTimeline`
- `aiCueHistory`
- `limitations`
- `methodologyVersion`
- `exportStatus`

Squat and curl evidence includes:

- Rep number.
- Form score.
- Failed metrics.
- Joint angle evidence.
- Deterministic scorecard output.
- ML prediction if available.
- Confidence gate result.

Dance evidence includes:

- Phrase name.
- Timing score.
- Pose similarity.
- Groove or bounce score.
- Reference skeleton checkpoint.
- Learner deviation summary.

## API Design

Add these review routes:

- `GET /api/review-lab/sessions`
- `GET /api/review-lab/sessions/[sessionId]`
- `POST /api/review-lab/export`
- `GET /api/review-lab/methodology`

The APIs must use the existing authenticated-session guard. Demo mode may return fixture-backed review sessions for presentation, but real authenticated users should only see their own sessions.

## AI Feedback Rules

AI feedback in Review Lab must be grounded in measured evidence.

Every AI cue shown in a report should include:

- Measured metric.
- Rep or phrase number.
- Confidence.
- Evidence source: rule engine, ML evaluator, dance comparator, or camera gate.
- Allowed claim level: AI coach guidance, not medical diagnosis.

The report must also show suppressed feedback when the system refuses to generate a claim.

Suppression reasons include:

- Camera confidence too low.
- Body partially out of frame.
- Wrong or uncertain exercise detection.
- Insufficient reps or phrases.
- Landmark visibility unreliable.

The goal is to show that the AI is constrained by evidence rather than hallucinating feedback.

## Error Handling

The Review Lab should handle incomplete evidence gracefully.

Expected states:

- No sessions yet: show an empty state with links to squat, curl, and dance sessions.
- Session has low confidence: show the report with a clear limitation banner.
- Session has no ML prediction: show deterministic scorecard evidence and mark ML evidence unavailable.
- Export fails: keep the report visible and show a retryable error.
- User accesses another user’s report: return unauthorized or not found.

## Testing

Unit tests:

- Evidence builder maps squat scorecards correctly.
- Evidence builder maps curl scorecards correctly.
- Dance phrase evidence maps from comparator output correctly.
- Low camera confidence adds a limitation.
- AI feedback cannot claim diagnosis or injury assessment.
- Methodology API returns versioned claim boundaries.

Fixture tests:

- Clean squat session produces high score and mostly passing evidence.
- Flawed squat session shows depth or knee-tracking issues.
- Clean curl session shows stable elbow and wrist evidence.
- Flawed curl session shows shoulder swing or incomplete range of motion.
- Dance phrase fixture shows timing or pose deviation.

UI tests:

- Review Lab dashboard loads.
- Session report shows score, confidence, mistakes, evidence, and limitations.
- Methodology page explains non-medical scope.
- Export action produces a report payload.

## Success Criteria

The feature is successful when:

- A professor can understand exactly why the system gave a correction.
- At least one squat, one curl, and one dance report can be demoed.
- The app clearly separates measured evidence from AI-generated wording.
- Reports include confidence and limitations.
- The app makes no medical-grade or diagnostic claims.
- The report can be used directly in the final-year presentation.

## Out of Scope for First Version

- Raw video storage.
- Clinical diagnosis.
- Medical-grade claims.
- Multi-user professor accounts or classroom administration.
- Full dataset training UI.
- Automatic PDF rendering if a structured export payload is enough for the first pass.

