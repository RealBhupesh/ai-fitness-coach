# AI Fitness Dance Diet Coach

Production-oriented Next.js application for:
- authenticated AI coaching chat
- real-time workout posture feedback
- dance phrase guidance and scoring
- AI workout and nutrition generation
- progress, achievements, and session history

## Stack

- Next.js 15 + React 19 + TypeScript 5
- Drizzle ORM + PostgreSQL
- better-auth
- MediaPipe Pose
- Groq as primary LLM provider
- OpenAI as fallback LLM provider

## Core Architecture

- Public routes: `/`, `/login`, `/signup`
- Authenticated routes: `/dashboard`, `/coach/*`, `/workouts`, `/workout-plans`, `/nutrition`, `/progress`, `/achievements`, `/settings`, `/onboarding`
- Middleware only redirects based on session-cookie presence
- Route handlers are the real auth boundary through `requireServerSession()`
- Live coach runtime is centered in [src/components/PoseAnalyzer.tsx](/g:/@final%20year%20project/ai-fitness-dance-diet-coach-main/src/components/PoseAnalyzer.tsx)

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
```

Notes:
- `DATABASE_URL` must point to PostgreSQL now. SQLite/libSQL is no longer the active baseline.
- If `GROQ_API_KEY` is set, Groq is used first.
- If Groq is unavailable and `OPENAI_API_KEY` exists, OpenAI is used as fallback.

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Push the schema to your Postgres database:
```bash
npm run db:push
```

3. Seed baseline content:
```bash
npm run db:seed
```

4. Start the app:
```bash
npm run dev
```

5. Optional health check:
```bash
curl http://localhost:3000/api/health
```

## Available Scripts

```bash
npm run dev
npm run build
npm run test
npm run test:e2e
npm run db:generate
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

## Tests

Current automated coverage includes:
- Vitest unit tests for pose math
- Vitest unit tests for the dance comparator
- Vitest unit tests for request-guard behavior
- Playwright smoke coverage for login and signup rendering

Real-device camera QA is still required before calling the live coach fully release-ready.

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

- `npm run build` passes
- protected POST APIs now require authenticated sessions
- request origin checks and in-memory rate limiting are enabled on mutating APIs
- chat session summary/context are now used in the AI prompt path
- live coach voice feedback is handled through a dedicated controller
- dance now uses a packaged routine asset plus segment comparison

For deeper handoff history, use `CONTEXT.md`.
