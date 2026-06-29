# Dance AI Course Audit

Date: 2026-06-29

## Scope

Reviewed the Dance AI module from the browser-visible course flow:

1. Course overview
2. Tutorial steps
3. Live coach calibration state
4. Active step coach
5. Dashboard entry point

Screenshots are saved in this folder.

## Current Strengths

- The module now has a real course-like entry screen instead of only a camera tool.
- The tutorial is split into phrase steps with counts, mistakes, corrections, and target metrics.
- The live coach already has camera reliability gating and measured feedback language.
- The dashboard has a visible coaching plan and achievement prompt.
- The visual system is consistent with the rest of the app.

## What Still Needs Development

### Must Build

1. Course progress tracking
Users need saved completion state for each dance lesson, tutorial step, and scoring attempt. Right now the tutorial is visible, but it does not behave like a persisted course.

2. Lesson completion rules
Define what counts as completing a step: watch tutorial, run live attempt, minimum reliability, minimum score, or manual completion.

3. Real dance leaderboard data
The current people scoring data is demo/static. It should be backed by saved workout session scores and ranked by user, score, streak, and routine.

4. Dance achievement integration
Achievements exist, but the dance course needs clearer in-flow unlocks after finishing a phrase or scoring above a threshold.

5. Course-level database model
Add entities for dance courses, lessons, user course progress, attempts, best score, and completion date.

6. More routine content
The module currently has one beginner hip-hop routine. A production course should have multiple routines by difficulty.

### Should Build

1. Reference media
Add real tutorial video, animated skeleton previews, or generated coach visuals for each step. Text-only teaching is not enough for dance learning.

2. Attempt history
Show previous attempts per step with score, timing, reliability, and improvement trend.

3. Guided practice mode
Add a mode where the user practices one step repeatedly before starting the full routine.

4. Better dashboard entry
Dashboard currently recommends squat first in demo mode. If the user enters Dance Coach, the dashboard should also surface the active dance course and next dance lesson.

5. Mobile layout QA
The course uses dense panels and large typography. It needs explicit mobile testing for scrolling, camera controls, and card readability.

6. Camera permission onboarding
Add a short pre-camera setup state explaining distance, lighting, full-body framing, and privacy before the browser permission prompt.

### Nice To Have

1. Course certificates or completion summary
Useful for college demo and product polish: "Hip-Hop Starter Groove completed, best score 88."

2. Friends/class mode
Allow comparison among classmates, not only a static leaderboard.

3. Difficulty unlock path
Beginner routine unlocks intermediate only after minimum score/reliability.

4. Audio-count sync controls
Add metronome/count-in, restart phrase, pause, and loop selected segment.

5. Teacher/demo mode
A prepared demo mode for presentation when camera conditions are poor.

## Accessibility And UX Risks

- Several tutorial step cards look clickable, but keyboard/focus behavior should be verified.
- The course relies heavily on color accents for selected state; add clearer text/state indicators.
- Live camera controls need keyboard and screen-reader checks.
- The dashboard entry does not make Dance Coach the primary next action, even when reviewing the dance course.
- Screenshots cannot prove full accessibility compliance; keyboard navigation, focus order, and screen reader labels still need manual testing.

## Recommended Build Order

1. Persist dance course progress and attempts.
2. Replace static leaderboard with session-backed leaderboard.
3. Add guided practice mode and course completion rules.
4. Add more routines and reference media.
5. Polish dashboard entry, mobile QA, and accessibility checks.
