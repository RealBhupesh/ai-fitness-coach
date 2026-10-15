# Deploy and operate the production beta

Audience: developer operating this app. Keep previews separate from production accounts, databases, Redis keys, and AI provider budgets.

## 1. Inventory and preserve existing data

Set `INVENTORY_DATABASE_URL` through your shell or secret manager. Run `npm run db:inventory -- reports/inventory.json` after creating the private reports directory. The inventory uses a read-only transaction and reports counts, not account identities. Do not set `AUTH_MIGRATION_INVENTORIED=true` before reviewing it.

Keep the deployment revision associated with every backup. Set `DATABASE_URL` and `BACKUP_ENCRYPTION_KEY` (32 random bytes encoded as base64), storing the key independently from backup files. Run:

```sh
npm run db:backup -- backups/pre-beta.json.enc
```

This is an authenticated AES-256-GCM logical backup of the 27 app tables. It includes auth tables and must remain private. It has a 256 MiB plaintext limit; use managed PostgreSQL backups for larger deployments. It does not back up Clerk configuration, environment secrets, or infrastructure.

## 2. Test restoration

Create a separate empty UTF-8 database with a name ending in `_restore`. Set `RESTORE_DATABASE_URL` to it; it must differ from the source database. Use the same source revision and encryption key as the backup.

```sh
npm run db:restore -- backups/pre-beta.json.enc
```

Authentication and schema hashes are checked before writes. The restore creates schema from committed migrations and inserts rows in foreign-key order inside a transaction. It refuses populated app tables. Compare table counts and representative sessions, rep evidence, plans, and identities. Record the restore duration and result before release. Failed restoration leaves schema in the disposable target; never point the command at an active database.

Enable provider-managed backups and rehearse restoring to a new database. Schedule an encrypted app backup daily in a trusted operator runner with these same commands; keep the last seven daily backups and four weekly backups. Store them outside the repository with the encryption key in a separate secret store. Credentials must not appear in command arguments or logs.

## 3. Configure staging, then production

- Provision separate Clerk instances for development and production, Neon databases, and Upstash Redis namespaces. Put the pooled PostgreSQL URL in `DATABASE_URL`; remote certificates are verified.
- Configure real HTTPS `NEXT_PUBLIC_APP_URL` and exact `TRUSTED_ORIGINS` values. Never copy localhost origins to production.
- Supply Clerk public/secret keys, Upstash REST URL/token, and a random `CRON_SECRET` of at least 32 characters.
- Keep both demo flags false. Set `BETA_ACCOUNT_LIMIT=50`, `NEXT_PUBLIC_LEARNED_POSTURE_MODE=disabled`, and `AUTH_MIGRATION_INVENTORIED=true` only after steps 1–2.
- Keep `BETA_SIGNUPS_OPEN=false` until all application release evidence in the checklist passes; then set it true to admit at most the configured account cap. Managed service provisioning and secret insertion happen in your accounts; the repository contains no production credentials.
- Apply committed migrations once through a deployment job, then run the idempotent content seed. Do not use `db:push` in production. Existing exercise IDs remain valid; saves resolve movement slugs to the catalog.

Deploy a Vercel preview against staging services. Verify `/api/health`, verified Clerk signup/login/logout, profile persistence, full workflows, quotas during Redis failure, and deletion retries. Then deploy the same revision to production. Do not attach preview deployments to the production database.

## 4. Migrate legacy identity deliberately

Default production auth is Clerk. If legacy accounts exist, enable `ENABLE_LEGACY_AUTH=true` and `NEXT_PUBLIC_ENABLE_LEGACY_AUTH=true` for a controlled migration period, using a strong Better Auth secret. Production email/password and OAuth registration are disabled. Published development/demo secrets are rejected; omit `BETTER_AUTH_SECRET` when legacy auth is disabled, or supply a new random secret during migration. A user must prove both sessions to `POST /api/account/link`; matching email alone never grants access to another user's data.

An email collision returns `IDENTITY_LINK_REQUIRED`. Sign into the existing account and Clerk in the same browser; use the Settings link action. If a provider identity is already bound to another local account, stop and investigate; do not merge data automatically. Disable legacy auth after migration evidence confirms accounts are linked. Existing Clerk users created before provider mappings were added also need inventory and a verified mapping migration; do not infer ownership from email.

## 5. Monitor and recover

Structured server events contain request IDs, status codes, provider/model identifiers, usage, and latency. They omit prompts, profiles, URLs, credentials, raw video, and landmarks. The browser reports no stack traces to parent frames in production. Capture these events in your hosting logs and configure alerts for repeated 5xx errors, quota-service failures, saved-session failures, and provider failover spikes.

Quotas: 20 chat messages/day/user; two workout and two nutrition generations/day/user; five summaries/day/user. AI has a shared conservative reservation limit of 200,000 tokens/day and 2,000 attempts/day. Reservations include failed attempts and are not refunded. These controls bound usage, not provider pricing; configure provider spending alerts separately.

Workouts use a client session UUID plus a canonical payload hash. Exact retries return the original session; conflicting retries return 409. Pending summaries are scoped to the signed-in user and kept on their device until saved. Leaving a running camera session queues its current summary before capture is released; interrupted network requests can be retried after sign-in. Clearing browser storage can discard unsaved summaries; surface the retry banner before beginning another workout.

Account deletion removes local owned rows and revokes local sessions. A minimal identity tombstone remains to prevent re-creation while external cleanup completes. Clerk deletion is retried by the protected daily `/api/operations/deletions` cron. Verify the cron in your deployment and alert if pending jobs persist. Disable a model immediately by setting `NEXT_PUBLIC_LEARNED_POSTURE_MODE=disabled` and rebuilding, or disabling its manifest entry.

Rollback app code to the previous validated Vercel revision. The beta migration adds nullable session metadata and new tables; retain these during code rollback. Restore data into a new database and switch the connection only after verification. Avoid destructive down migrations.
