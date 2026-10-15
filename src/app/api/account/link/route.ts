import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { providerIdentities, users, accountDeletionJobs } from "@/db/schema";
import { auth } from "@/lib/auth/config";
import { isLegacyAuthEnabled, assertProductionEnvironment } from "@/lib/env";
import { apiError, ApiError } from "@/lib/server/api";
import { guardMutationRequest } from "@/lib/security/request-guard";
export async function POST(request: Request) {
  try {
    assertProductionEnvironment();
    if (!isLegacyAuthEnabled()) throw new ApiError(403, "MIGRATION_DISABLED", "Account migration is disabled");
    const [clerk, legacy, clerkUser] = await Promise.all([clerkAuth(), auth.api.getSession({ headers: request.headers }), currentUser()]);
    if (!clerk.userId || !legacy?.user.id) throw new ApiError(401, "BOTH_SESSIONS_REQUIRED", "Sign in to your existing account and Clerk before linking");
    if (clerkUser?.primaryEmailAddress?.verification?.status !== "verified") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your Clerk email first");
    const guard = await guardMutationRequest(request, { bucket: "account-link", key: legacy.user.id, limit: 5, windowMs: 300000 });
    if (guard) return guard;
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(87239401)`);
      if (await tx.query.accountDeletionJobs.findFirst({ where: and(eq(accountDeletionJobs.provider, "clerk"), eq(accountDeletionJobs.subject, clerk.userId!)) })) throw new ApiError(403, "ACCOUNT_DELETION_PENDING", "Account cleanup is pending");
      const linkedUser = await tx.query.providerIdentities.findFirst({ where: and(eq(providerIdentities.provider,"clerk"), eq(providerIdentities.userId,legacy.user.id)) });
      if (linkedUser && linkedUser.subject !== clerk.userId) throw new ApiError(409,"IDENTITY_ALREADY_LINKED","This existing account is already linked to another Clerk identity");
      const mapping = await tx.query.providerIdentities.findFirst({ where: and(eq(providerIdentities.provider, "clerk"), eq(providerIdentities.subject, clerk.userId!)) });
      if (mapping && mapping.userId !== legacy.user.id) throw new ApiError(409, "IDENTITY_ALREADY_LINKED", "This Clerk identity is linked to a different account");
      if (!await tx.query.users.findFirst({ where: eq(users.id, legacy.user.id) })) throw new Error("UNAUTHORIZED");
      if (!mapping) await tx.insert(providerIdentities).values({ id: nanoid(), userId: legacy.user.id, provider: "clerk", subject: clerk.userId! });
    });
    return NextResponse.json({ linked: true });
  } catch (error) { return apiError(error, request); }
}
