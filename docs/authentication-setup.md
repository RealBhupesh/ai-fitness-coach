# Authentication Setup

This app supports two auth paths:

- Clerk for Vercel-native production auth.
- Better Auth email/password for the existing local flow.

## Recommended Production Setup: Clerk

1. Install the Vercel Marketplace integration:

```bash
vercel integration add clerk
```

2. Install dependencies:

```bash
npm install
```

3. Configure local environment:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fitcoach
BETTER_AUTH_SECRET=make-this-a-long-random-secret-at-least-32-chars
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
TRUSTED_ORIGINS=http://localhost:3000

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

4. Run database migrations:

```bash
npm run db:migrate
```

5. Start the app:

```bash
npm run dev
```

If Turbopack fails in this workspace path, use:

```bash
npx next dev --webpack
```

## Routes

- `/sign-in` - Clerk sign-in
- `/sign-up` - Clerk sign-up
- `/sign-out` - Clerk sign-out
- `/login` - existing email/password login plus Clerk handoff
- `/signup` - existing email/password signup plus Clerk handoff

## Identity Bridge

When a Clerk user signs in, `src/lib/auth/session.ts` maps them into the existing `users` table by email. This keeps profile, workout, nutrition, and coach-memory APIs working with the same `requireServerSession()` guard already used throughout the backend.

If an existing Better Auth user has the same email, Clerk reuses that database user row so profile data is preserved.

## Required Production Infrastructure

- PostgreSQL database.
- `DATABASE_URL`.
- Clerk keys from Vercel Marketplace or Clerk dashboard.
- Strong `BETTER_AUTH_SECRET` because the legacy email/password route still exists.

