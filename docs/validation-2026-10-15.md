# Local validation — 15 October 2026

These results apply to the uncommitted production-beta implementation in this checkout. They are local engineering evidence, not authorization to launch the beta.

## Environment

Windows, Node.js 24.16, Python 3.14, isolated PostgreSQL 18 with UTF-8 databases, and Playwright Chromium. CI is configured for Node.js 22, Python 3.12, and PostgreSQL 16; GitHub Actions has not been run from this workspace.

Production build ID: `-_JDZN1p2VIZB4C7525H9`.

## Results

| Check | Result |
| --- | --- |
| Unit tests | 154 passed across 39 files |
| Python model-pipeline guards | 10 passed; deployment rights, synthetic evidence rejection, split leakage, recording provenance, permitted uses, labels, unsupported wrist faults, and grouped uncertainty calculations |
| TypeScript | Passed `npm run typecheck` and the production build typecheck |
| Lint | Passed; generated artifacts and dependency export graphs are excluded, with dependency imports checked by TypeScript/build |
| Migration metadata | `drizzle-kit check` passed |
| Real PostgreSQL migrations | Fresh setup, upgrade retaining a legacy user, and repeat migration passed; 27 app tables |
| Real PostgreSQL integrity | 6 passed: concurrent duplicate/conflicting saves, ownership isolation, rollback, identity uniqueness, cascade deletion, packaged dance deduplication, encrypted backup checks and full restoration |
| Encrypted restore | Engine round trip and documented `db:backup` / `db:restore` CLI commands passed. Every restored row matched across 27 app tables; tamper and overwrite refusal tested |
| Browser workflows | 20 passed, with one production-only test skipped; includes persisted workflows, sign-out, offline extraction, worker artifact, camera lifecycle, and preview-mode/save regression checks |
| Offline normalization | Passed the browser decoder/worker fixture: timestamped frames, image aspect ratio, model checksum, synthetic provenance, and no local video paths in output. No learned artifact produced |
| Geometry | Passed angle invariance checks for landscape, square, and portrait frames; drawing coordinates remain separate from analysis coordinates |
| Camera worker | Passed with a fake camera and GPU disabled: initialization, frame replies, one frame in flight, route navigation, and track cleanup |
| Production build/public smoke | Production build passed; 7 public/worker/gate smoke tests passed, with 14 development-authenticated tests intentionally skipped in production mode |

The workflow test covers profile setup, workout save/retry/conflict, workout and nutrition plan generation using the identified local fallback, nutrition logging, progress, recovery, settings, chat, cross-user session denial, account export, profile reset retaining workouts, and full local deletion. Page render checks alone do not establish interactive acceptance of every control.

Earlier browser attempts exposed slow cold-route compilation and a temporary database connection timeout under concurrent validation load. Tests now separate page checks from data workflows and give client navigation explicit waits. The camera test uses Playwright-managed browser fixtures and captures a small diagnostic state instead of a video trace. Worker bundling was moved to esbuild after a syntax failure in a development worker chunk. Navigation now releases capture before routing, and active sessions queue a summary before leaving. A synthetic-landmark browser regression exposed fractional phase timestamps rejected by the save schema; a failing unit test reproduced this before the fix. Persisted evidence now uses integer milliseconds elapsed since session start. Preview mode changes preserve the same video element; minimized capture uses decoded-frame progress with backpressure and stall reset.

## Release gates still open

- Inventory and back up the existing deployment before enabling identity migration. No deployed data was accessed or migrated.
- Provision and verify separate Vercel/Neon/Upstash/Clerk staging and production services. Exercise real Clerk linking, provider cleanup retries, shared Redis limits/outages, AI provider outages, managed backups, and cron delivery.
- Run CI and authenticated staging acceptance on the deployment revision. Public production smoke checks do not validate authenticated Clerk workflows.
- Complete the camera-view observability audit, including projected squat depth/torso measurements and curl angle assumptions. Synthetic geometry tests establish coordinate consistency, not biomechanical validity or fault accuracy.
- Validate all exercise controls, packaged dance timing, camera recovery, accessibility, and failure recovery on laptop Chrome/Edge and two physical Android tiers. Rep-count and cue-latency targets remain unmeasured on real people/devices.
- Admit appropriately licensed public datasets with genuine fault labels; train and evaluate separate squat/curl artifacts. No learned form model has been trained or promoted in this checkout. Representative webcam validation, sample counts, uncertainty, and calibration evidence are still required.

Keep `BETA_SIGNUPS_OPEN=false` and `NEXT_PUBLIC_LEARNED_POSTURE_MODE=disabled` until their separate release gates pass. See the release checklist and production runbook for the rollout procedure.
