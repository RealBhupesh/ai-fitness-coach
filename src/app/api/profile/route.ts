import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { getAppProfile, toProfileDbInput } from "@/lib/server/app-data";
import { requireServerSession } from "@/lib/auth/session";
import { profileInputSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const session = await requireServerSession();
    const profile = await getAppProfile(session.user.id);

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const parsed = profileInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
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
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to save profile" }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireServerSession(request);
    await db.delete(userProfiles).where(eq(userProfiles.userId, session.user.id));
    const profile = await getAppProfile(session.user.id);
    return NextResponse.json({ message: "Profile reset", profile });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
