import { getSessionCookie } from "better-auth/cookies";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth/config";
import { isClerkAuthEnabled } from "@/lib/env";
import { hasDemoCookie, buildDemoServerSession } from "@/lib/dummy-auth";

type RequestLike = NextRequest | Request | Headers | undefined;

function toHeaders(source?: RequestLike): Headers {
  if (!source) {
    return new Headers();
  }
  if (source instanceof Headers) {
    return source;
  }
  if ("headers" in source) {
    return new Headers(source.headers);
  }
  return new Headers();
}

async function getClerkServerSession() {
  if (!isClerkAuthEnabled()) {
    return null;
  }

  try {
    const user = await currentUser();
    if (!user?.id) return null;

    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    if (!email) return null;

    const name = user.fullName || user.username || email.split("@")[0] || "FitCoach user";
    const image = user.imageUrl || null;
    const now = new Date();

    if (!isDatabaseConfigured) {
      const id = `clerk:${user.id}`;
      return {
        session: {
          id,
          userId: id,
          expiresAt: new Date(now.getTime() + 60 * 60 * 24 * 7 * 1000),
        },
        user: {
          id,
          email,
          name,
          image,
          emailVerified: Boolean(user.primaryEmailAddress?.verification?.status === "verified"),
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    const existingByEmail = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (existingByEmail) {
      await db
        .update(users)
        .set({
          name,
          image,
          emailVerified: Boolean(user.primaryEmailAddress?.verification?.status === "verified"),
          updatedAt: now,
        })
        .where(eq(users.id, existingByEmail.id));

      return {
        session: {
          id: `clerk:${user.id}`,
          userId: existingByEmail.id,
          expiresAt: new Date(now.getTime() + 60 * 60 * 24 * 7 * 1000),
        },
        user: {
          ...existingByEmail,
          name,
          image,
          emailVerified: Boolean(user.primaryEmailAddress?.verification?.status === "verified"),
        },
      };
    }

    const id = `clerk:${user.id}`;
    const newUser = {
      id,
      email,
      name,
      image,
      emailVerified: Boolean(user.primaryEmailAddress?.verification?.status === "verified"),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values(newUser).onConflictDoNothing();

    return {
      session: {
        id,
        userId: id,
        expiresAt: new Date(now.getTime() + 60 * 60 * 24 * 7 * 1000),
      },
      user: newUser,
    };
  } catch {
    return null;
  }
}

export async function getServerSession(source?: RequestLike) {
  const requestHeaders = source ? toHeaders(source) : new Headers(await headers());
  const cookieHeader = requestHeaders.get("cookie") || "";

  if (hasDemoCookie(cookieHeader)) {
    return buildDemoServerSession() as any;
  }

  const clerkSession = await getClerkServerSession();
  if (clerkSession?.user?.id) return clerkSession;

  if (isDatabaseConfigured) {
    try {
      const session = await auth.api.getSession({ headers: requestHeaders });
      if (session?.user?.id) return session;
    } catch {}
  }

  return null;
}

export async function requireServerSession(source?: RequestLike) {
  const session = await getServerSession(source);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function hasSessionCookie(source: RequestLike) {
  const requestHeaders = toHeaders(source);
  return Boolean(getSessionCookie(requestHeaders) || requestHeaders.get("cookie")?.includes("__session="));
}
