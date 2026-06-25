# AI Fitness Dance Diet Coach

Production-oriented Next.js application for:
- authenticated AI coaching chat
- real-time workout posture feedback
- dance phrase guidance and scoring
- AI workout and nutrition generation
- progress, achievements, and session history

## Stack

- Next.js 16 + React 19 + TypeScript 5
- Drizzle ORM + PostgreSQL
- better-auth
- MediaPipe Pose Landmarker Web Tasks
- Groq as primary LLM provider
- OpenAI as fallback LLM provider

## Core Architecture

- Public routes: `/`, `/login`, `/signup`
- Authenticated routes: `/dashboard`, `/coach/*`, `/workouts`, `/workout-plans`, `/nutrition`, `/progress`, `/achievements`, `/settings`, `/onboarding`
- Proxy only redirects based on session-cookie presence
- Route handlers are the real auth boundary through `requireServerSession()`
- Live coach runtime is centered in [src/components/PoseAnalyzer.tsx](/g:/@final%20year%20project/ai-fitness-dance-diet-coach-main/src/components/PoseAnalyzer.tsx)
- The live runtime is split across:
  - `src/lib/camera/controller.ts`
  - `src/lib/pose/tracking-engine.ts`
  - `src/lib/pose/quality.ts`
  - `src/lib/pose/session-buffer.ts`
  - `src/lib/pose/replay.ts`
- Demo auth is available only when `ENABLE_DEMO_MODE` or `NEXT_PUBLIC_ENABLE_DEMO_MODE` is explicitly enabled

## Environment

Copy `.env.example` to `.env.local`.

Required:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fitcoach
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional but strongly recommended:
```env
TRUSTED_ORIGINS=http://localhost:3000
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
ENABLE_DEMO_MODE=false
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
```

Notes:
- `DATABASE_URL` must point to PostgreSQL now. SQLite/libSQL is no longer the active baseline.
- Production rejects missing env and placeholder/short `BETTER_AUTH_SECRET` values.
- Demo mode defaults to off in production. Enable it only for controlled demos.
- If `GROQ_API_KEY` is set, Groq is used first.
- If Groq is unavailable and `OPENAI_API_KEY` exists, OpenAI is used as fallback.

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Start local PostgreSQL, or use Docker Compose:
```bash
docker compose up -d db
```

3. Apply migrations:
```bash
npm run db:migrate
```

4. Seed baseline content:
```bash
npm run db:seed
```

5. Start the app:
```bash
npm run dev
```

6. Optional health check:
```bash
curl http://localhost:3000/api/health
```

`npm run db:push` is still available for local schema iteration. Use committed migrations through `npm run db:migrate` for production-like environments.

## Production Build

```bash
npm run db:check
npm run test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=moderate
```

The build script uses `next build --webpack` because Next 16 Turbopack currently panics on this repository path/layout. Keep Webpack for release builds until that upstream issue is fixed and verified.

To run the built app locally:
```bash
npm start
```

To run the containerized stack:
```bash
docker compose up --build
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

## Demo Mode

- `/login` and `/signup` include a `Continue as Demo User` action only when demo mode is enabled.
- Demo mode sets a local cookie and localStorage marker instead of creating a real Better Auth session.
- Protected pages open normally because proxy and `getServerSession()` recognize the demo session when demo mode is enabled.
- Some write-heavy APIs return safe stubbed success responses in demo mode so you can test the UI flow without mutating the real database.

## Available Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:prod
npm run db:generate
npm run db:check
npm run db:migrate
npm run db:push
npm run db:seed
npm run db:studio
```

## Dance Module

The primary routine pack lives in:
- `public/routines/starter-groove-pack.json`
- `public/routines/starter-groove-click.wav`
- `public/routines/starter-groove-thumbnail.svg`

The server route `GET /api/dance/routine` prefers the packaged routine asset and falls back to the DB-seeded routine only if the asset pack is unavailable.

## Movement Intelligence Review Lab

The Review Lab is a professor-facing evidence layer for squat, bicep curl, and dance sessions.

Routes:
- `/review-lab`
- `/review-lab/[sessionId]`
- `/review-lab/methodology`

It shows structured evidence, camera confidence, AI cue grounding, limitations, and exportable report payloads. It does not store raw video and does not make medical-grade or diagnostic claims.

## Tests

Current automated coverage includes:
- Vitest unit tests for pose math
- Vitest unit tests for frame-quality gating
- Vitest unit tests for session post-set buffering
- Vitest replay coverage for pause/resume rep counting
- Vitest unit tests for the dance comparator
- Vitest unit tests for request-guard behavior
- Playwright smoke coverage for login and signup rendering
- Playwright production smoke mode through `npm run test:e2e:prod`

Playwright notes:
- the smoke suite starts Next.js on an isolated default port (`3100`) so it does not hang when `3000` is already occupied locally
- production smoke mode builds first, starts `next start`, and disables demo mode by default

Real-device camera QA is still required before calling the live coach fully release-ready.

Replay and benchmark scaffolding now lives in:
- `src/lib/pose/replay.ts`
- `fixtures/live-stack/README.md`
- `docs/live-stack-validation.md`
- `docs/fitness-module-readiness.md`
- `docs/hip-hop-training-engine.md`

## Important Files

Read these first if you are taking over:
- `CONTEXT.md`
- `src/db/schema.ts`
- `src/db/index.ts`
- `src/lib/auth/config.ts`
- `src/lib/server/app-data.ts`
- `src/lib/pose/*`
- `src/lib/dance/*`
- `src/components/PoseAnalyzer.tsx`
- `src/app/api/*`

## Current Status

- `npm run build` passes on Next 16 through Webpack
- `npm audit --audit-level=moderate` reports 0 vulnerabilities
- protected POST APIs now require authenticated sessions
- request origin checks and in-memory rate limiting are enabled on mutating APIs
- chat session summary/context are now used in the AI prompt path
- live coach voice feedback is handled through a dedicated controller
- live camera/tracking now runs through a dedicated camera controller + Pose Landmarker engine instead of the old script-injected runtime
- dance now uses a packaged routine asset plus segment comparison
- replay harness and validation docs now exist for deterministic live-stack regression testing

For deeper handoff history, use `CONTEXT.md`.
