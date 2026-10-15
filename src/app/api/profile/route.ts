import { apiError, readJson } from "@/lib/server/api";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, isDatabaseConfigured } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { clearFallbackAppProfile, getAppProfile, saveFallbackAppProfile, toProfileDbInput } from "@/lib/server/app-data";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser, DEMO_PROFILE_COOKIE_NAME, buildDemoProfile, getDemoProfileFromCookie, saveDemoProfile, clearDemoProfile } from "@/lib/dummy-auth";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { profileInputSchema } from "@/lib/validation/schemas";

function getCookieHeader(request?: Request) {
  return request?.headers.get("cookie") || "";
}

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      const profile = getDemoProfileFromCookie(getCookieHeader(request)) ?? buildDemoProfile();
      return NextResponse.json({ profile });
    }
    const profile = await getAppProfile(session.user.id);

    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "profile",
      key: session.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = profileInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    if (isDemoUser(session.user.id)) {
      const existingProfile = getDemoProfileFromCookie(getCookieHeader(request)) ?? buildDemoProfile();
      const profile = saveDemoProfile({
        ...existingProfile,
        ...payload,
        lastUpdated: new Date().toISOString(),
      });
      const response = NextResponse.json({ message: "Profile updated (demo mode)", profile });
      response.cookies.set(DEMO_PROFILE_COOKIE_NAME, encodeURIComponent(JSON.stringify(profile)), {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
      return response;
    }

    if (!isDatabaseConfigured) {
      const profile = saveFallbackAppProfile(session.user.id, payload);
      return NextResponse.json({ message: "Profile updated (demo deployment)", profile });
    }

    const profileData = toProfileDbInput(payload);
    const existing = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
    });

    if (payload.name) {
      await db.update(users).set({ name: payload.name, updatedAt: new Date() }).where(eq(users.id, session.user.id));
    }

    if (existing) {
      await db
        .update(userProfiles)
        .set({
          ...profileData,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, session.user.id));
    } else {
      await db.insert(userProfiles).values({
        id: nanoid(),
        userId: session.user.id,
        ...profileData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const profile = await getAppProfile(session.user.id);
    return NextResponse.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "profile-delete",
      key: session.user.id,
      limit: 6,
      windowMs: 5 * 60_000,
    });
    if (guard) {
      return guard;
    }

    if (isDemoUser(session.user.id)) {
      clearDemoProfile();
      const response = NextResponse.json({ message: "Profile reset", profile: buildDemoProfile() });
      response.cookies.set(DEMO_PROFILE_COOKIE_NAME, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      });
      return response;
    }

    if (!isDatabaseConfigured) {
      const profile = clearFallbackAppProfile(session.user.id);
      return NextResponse.json({ message: "Profile reset", profile });
    }

    await db.delete(userProfiles).where(eq(userProfiles.userId, session.user.id));
    const profile = await getAppProfile(session.user.id);
    return NextResponse.json({ message: "Profile reset", profile });
  } catch (error) {
    return apiError(error, request);
  }
}
