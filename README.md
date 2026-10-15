# AI Fitness Coach

Next.js 16 / React 19 app for exercise and dance coaching, plans, nutrition, progress, and session evidence. Production beta is gated pending staging services and physical-device validation. Learned posture models are **disabled by default**; current rule indicators are not trained-model probabilities.

## Local setup

Use Node 22+, npm, Python 3.12+, and PostgreSQL with UTF-8 encoding.

1. Copy `.env.example` to `.env.local`; configure PostgreSQL and a random Better Auth development secret.
2. Run `npm ci --legacy-peer-deps`.
3. Export `DATABASE_URL` into your shell for the Drizzle CLI (it does not load `.env.local` automatically).
4. Run `npm run db:migrate` and `npm run db:seed`.
5. Run `npm run dev`. If Turbopack fails in this Windows workspace, use `npx next dev --webpack`.

Local demos require explicit demo flags. Production never accepts demo cookies or database-free saves. Docker Compose is a local development stack; configure managed services for production.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run test:ml
npm run db:check
npm run build
```

Database checks require an isolated local database whose name contains `test`, with `TEST_DATABASE_URL` and `DATABASE_URL` pointing to it. Migrate and seed that database first.

```sh
npm run db:verify
npm run test:integration
```

Browser tests: install Chromium with `npx playwright install chromium`. Set `E2E_REAL_DATABASE=true` to exercise actual development authentication, persisted workflows, ownership, export, and deletion against the test database. `npm run test:e2e:prod` runs production public-route and worker-asset smoke tests; it does not validate live Clerk credentials.

## Guides

- [Production deployment and operations](docs/production-beta-runbook.md)
- [Model data, training, and promotion](docs/posture-model-pipeline.md)
- [Release evidence checklist](docs/beta-release-checklist.md)
- [Local validation results](docs/validation-2026-10-15.md)

Production target: Vercel, Neon PostgreSQL, Clerk, and Upstash. Run inventory and backup before auth migration. No automatic email-based identity linking.
