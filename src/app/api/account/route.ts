import { auth as clerkAuth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, providerIdentities, accountDeletionJobs, verificationTokens } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isClerkAuthEnabled } from "@/lib/env";
import { isDemoUser } from "@/lib/dummy-auth";
import { apiError, readJson, ApiError } from "@/lib/server/api";
import { guardMutationRequest } from "@/lib/security/request-guard";
import { finishAccountDeletion } from "@/lib/server/account-deletion";
export async function DELETE(request: Request) {
  try {
    const identity = isClerkAuthEnabled() ? await clerkAuth() : null;
    let job = identity?.userId ? await db.query.accountDeletionJobs.findFirst({ where: and(eq(accountDeletionJobs.provider, "clerk"), eq(accountDeletionJobs.subject, identity.userId)) }) : undefined;
    const session = job ? null : await requireServerSession(request);
    if (session && isDemoUser(session.user.id)) throw new ApiError(403, "DEMO_ACCOUNT", "Demo accounts cannot be deleted");
    const guard = await guardMutationRequest(request, { bucket: "account-delete", key: job?.userId ?? session!.user.id, limit: 5, windowMs: 300000 });
    if (guard) return guard;
    const body = await readJson(request, 1024) as { confirmation?: string };
    if (body?.confirmation !== "DELETE") throw new ApiError(400, "CONFIRMATION_REQUIRED", "Confirm account deletion");
    if (!job) {
      job = await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(87239401)`);
        const mapping = await tx.query.providerIdentities.findFirst({ where: eq(providerIdentities.userId, session!.user.id) });
        const [created] = await tx.insert(accountDeletionJobs).values({ id: nanoid(), userId: session!.user.id, provider: mapping?.provider ?? "better-auth", subject: mapping?.subject ?? session!.user.id }).onConflictDoNothing().returning();
        await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, session!.user.email));
        await tx.delete(users).where(eq(users.id, session!.user.id));
        return created ?? (await tx.query.accountDeletionJobs.findFirst({ where: eq(accountDeletionJobs.userId, session!.user.id) }))!;
      });
    }
    const completed = await finishAccountDeletion(job);
    const response = NextResponse.json({ deleted: true, cleanupPending: !completed }, { status: completed ? 200 : 202 });
    for (const name of ["better-auth.session_token", "__Secure-better-auth.session_token", "fitcoach_demo"]) response.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production" });
    return response;
  } catch (error) { return apiError(error, request); }
}
