import { getSessionCookie } from "better-auth/cookies";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { db, isDatabaseConfigured } from "@/db";
import { accountDeletionJobs, providerIdentities, users } from "@/db/schema";
import { auth } from "@/lib/auth/config";
import { assertProductionEnvironment, isClerkAuthEnabled, isDemoModeEnabled, isLegacyAuthEnabled } from "@/lib/env";
import { hasDemoCookie, buildDemoServerSession } from "@/lib/dummy-auth";
import { ApiError } from "@/lib/server/api";

type RequestLike = Request | Headers | undefined;
export type AppSession = { session: { id?: string; userId: string; expiresAt: Date | string }; user: { id: string; email: string; name: string; image?: string | null; emailVerified?: boolean | null } };
const toHeaders = (source?: RequestLike) => source instanceof Headers ? source : source ? source.headers : new Headers();

async function getClerkServerSession(requestHeaders: Headers): Promise<AppSession | null> {
  if (!isClerkAuthEnabled()) return null;
  const verified = await clerkAuth();
  if (!verified.userId) return null;
  if (!isDatabaseConfigured) throw new Error("DATABASE_UNAVAILABLE");
  const deleted = await db.query.accountDeletionJobs.findFirst({ where: and(eq(accountDeletionJobs.provider, "clerk"), eq(accountDeletionJobs.subject, verified.userId)) });
  if (deleted) throw new ApiError(403, "ACCOUNT_DELETION_PENDING", "This account has been deleted or is awaiting cleanup");
  const mapping = await db.query.providerIdentities.findFirst({ where: and(eq(providerIdentities.provider, "clerk"), eq(providerIdentities.subject, verified.userId)) });
  let user = mapping ? await db.query.users.findFirst({ where: eq(users.id, mapping.userId) }) : undefined;
  if (!user) {
    // Keep the proved legacy account active until an explicit link is completed,
    // including when the user changed their email in the new provider.
    if (isLegacyAuthEnabled() && getSessionCookie(requestHeaders)) {
      const legacy = await auth.api.getSession({ headers: requestHeaders });
      if (legacy?.user?.id) return legacy;
    }
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress;
    if (!email || email.verification?.status !== "verified") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your primary email before joining the beta");
    const emailAddress = email.emailAddress.toLowerCase();
    user = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(87239401)`);
      if (await tx.query.accountDeletionJobs.findFirst({ where: and(eq(accountDeletionJobs.provider, "clerk"), eq(accountDeletionJobs.subject, verified.userId!)) })) throw new ApiError(403, "ACCOUNT_DELETION_PENDING", "Account cleanup is pending");
      const existingMapping = await tx.query.providerIdentities.findFirst({ where: and(eq(providerIdentities.provider, "clerk"), eq(providerIdentities.subject, verified.userId!)) });
      if (existingMapping) return (await tx.query.users.findFirst({ where: eq(users.id, existingMapping.userId) }))!;
      const existingEmail = await tx.query.users.findFirst({ where: sql`lower(${users.email}) = ${emailAddress}` });
      if (existingEmail) throw new ApiError(409, "IDENTITY_LINK_REQUIRED", "An existing account uses this email. Sign in to both accounts to link them in Settings.");
      if (process.env.NODE_ENV === "production" && process.env.BETA_SIGNUPS_OPEN !== "true") throw new ApiError(503, "BETA_CLOSED", "Beta registration is not open yet.");
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(users);
      const capacity = Number(process.env.BETA_ACCOUNT_LIMIT || 50);
      if (!Number.isInteger(capacity) || capacity < 1 || count >= capacity) throw new ApiError(503, "BETA_FULL", "The beta is full. Please check back later.");
      const [created] = await tx.insert(users).values({ id: nanoid(), email: emailAddress, name: clerkUser!.fullName || clerkUser!.username || "Athlete", image: clerkUser!.imageUrl, emailVerified: true }).returning();
      await tx.insert(providerIdentities).values({ id: nanoid(), userId: created.id, provider: "clerk", subject: verified.userId! });
      return created;
    });
  }
  return { user, session: { id: verified.sessionId ?? undefined, userId: user.id, expiresAt: new Date((verified.sessionClaims?.exp ?? 0) * 1000) } };
}

export async function getServerSession(source?: RequestLike): Promise<AppSession | null> {
  assertProductionEnvironment();
  const requestHeaders = source ? toHeaders(source) : new Headers(await headers());
  if (isDemoModeEnabled() && hasDemoCookie(requestHeaders.get("cookie") || "")) return buildDemoServerSession();
  try {
    const clerkSession = await getClerkServerSession(requestHeaders);
    if (clerkSession) return clerkSession;
  } catch (error) {
    // Ownership is proved by the legacy session; linking still requires both sessions.
    if (!(error instanceof ApiError) || error.code !== "IDENTITY_LINK_REQUIRED" || !isLegacyAuthEnabled()) throw error;
    const legacy = await auth.api.getSession({ headers: requestHeaders });
    if (legacy?.user?.id) return legacy;
    throw error;
  }
  if (isLegacyAuthEnabled() && isDatabaseConfigured) {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (session?.user?.id) return session;
  }
  return null;
}

export async function requireServerSession(source?: RequestLike) {
  const session = await getServerSession(source);
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function hasSessionCookie(source: RequestLike) {
  const requestHeaders = toHeaders(source);
  return Boolean(getSessionCookie(requestHeaders) || requestHeaders.get("cookie")?.includes("__session="));
}
