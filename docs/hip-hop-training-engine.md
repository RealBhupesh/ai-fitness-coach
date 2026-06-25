# Hip-Hop Training Engine

The production dance vertical is a beginner hip-hop starter groove.

## What It Does

- Loads the packaged `Hip-Hop Starter Groove` routine.
- Builds one tutorial step per phrase.
- Renders a coach reference skeleton for the active phrase.
- Compares the learner skeleton against target landmarks and phrase metrics.
- Scores pose shape, groove bounce, arm hits, torso control, timing, and transition quality.
- Grounds AI feedback in measured metrics, the current count, and the reference skeleton.
- Blocks medical or injury-diagnosis claims; this is AI dance coach guidance only.

## Current Routine

Routine asset:
- `public/routines/starter-groove-pack.json`

Engine:
- `src/lib/dance/training-engine.ts`

UI:
- `src/components/PoseAnalyzer.tsx`

Tests:
- `src/lib/dance/training-engine.test.ts`
- `src/lib/dance/comparator.test.ts`

## Remaining SOTA Gap

This is a full production-ready beginner routine engine, not a universal dance model yet. To push it toward state of the art:

- Add multi-angle reference videos or motion-capture-derived skeletons.
- Train temporal dance quality models on labeled videos.
- Add beat/audio onset tracking instead of fixed phrase windows only.
- Validate with different body types, camera placements, lighting, and dance skill levels.
- Add expert dancer annotations for timing, groove, and style quality.
