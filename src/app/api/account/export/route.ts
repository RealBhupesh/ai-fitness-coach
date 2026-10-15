import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import * as tables from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { apiError, ApiError } from "@/lib/server/api";
import { guardMutationRequest } from "@/lib/security/request-guard";
export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) throw new ApiError(403, "DEMO_ACCOUNT", "Demo data is not a personal account export");
    const guard = await guardMutationRequest(request, { bucket: "account-export", key: session.user.id, limit: 2, windowMs: 86400000 });
    if (guard) return guard;
    const data = await db.transaction(async tx => {
      const id = session.user.id;
      const [profile, settings, workouts, plans, nutrition, food, progress, chatSessions, chatMessages, awards, danceProgress, danceAttempts, memories, notices] = [
        await tx.select().from(tables.userProfiles).where(eq(tables.userProfiles.userId, id)),
        await tx.select().from(tables.userSettings).where(eq(tables.userSettings.userId, id)),
        await tx.select().from(tables.workoutSessions).where(eq(tables.workoutSessions.userId, id)),
        await tx.select().from(tables.workoutPlans).where(eq(tables.workoutPlans.userId, id)),
        await tx.select().from(tables.nutritionPlans).where(eq(tables.nutritionPlans.userId, id)),
        await tx.select().from(tables.foodLog).where(eq(tables.foodLog.userId, id)),
        await tx.select().from(tables.progressTracking).where(eq(tables.progressTracking.userId, id)),
        await tx.select().from(tables.chatSessions).where(eq(tables.chatSessions.userId, id)),
        await tx.select().from(tables.chatMessages).where(eq(tables.chatMessages.userId, id)),
        await tx.select().from(tables.userAchievements).where(eq(tables.userAchievements.userId, id)),
        await tx.select().from(tables.danceCourseProgress).where(eq(tables.danceCourseProgress.userId, id)),
        await tx.select().from(tables.danceCourseAttempts).where(eq(tables.danceCourseAttempts.userId, id)),
        await tx.select().from(tables.coachMemories).where(eq(tables.coachMemories.userId, id)),
        await tx.select().from(tables.notifications).where(eq(tables.notifications.userId, id)),
      ];
      const ids = workouts.map(w => w.id);
      const [exercises, reps, feedback] = ids.length ? [
        await tx.select().from(tables.workoutExercises).where(inArray(tables.workoutExercises.sessionId, ids)),
        await tx.select().from(tables.exerciseReps).where(inArray(tables.exerciseReps.sessionId, ids)),
        await tx.select().from(tables.sessionFeedbackEvents).where(inArray(tables.sessionFeedbackEvents.sessionId, ids)),
      ] : [[], [], []];
      return { profile, settings, workouts, plans, nutrition, food, progress, chatSessions, chatMessages, awards, danceProgress, danceAttempts, memories, notices, exercises, reps, feedback };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    return NextResponse.json({ version: 1, exportedAt: new Date().toISOString(), user: session.user, ...data }, { headers: { "Content-Disposition": 'attachment; filename="fitcoach-data.json"', "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, request); }
}
