import { saveWorkoutSession } from "@/lib/server/workout-persistence";
import { apiError, readJson, pagination } from "@/lib/server/api";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { exerciseReps, sessionFeedbackEvents, workoutExercises, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { updateCoachMemory } from "@/lib/server/coach-agent";
import { ensureAchievements } from "@/lib/server/app-data";
import { loadPrimaryDanceRoutinePack } from "@/lib/dance/routine-pack";
import { recordDanceCourseAttempt } from "@/lib/server/dance-course";
import { workoutSessionInputSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id) || !isDatabaseConfigured) {
      return NextResponse.json({ workouts: [] });
    }
    const workouts = await db.query.workoutSessions.findMany({
      where: eq(workoutSessions.userId, session.user.id),
      orderBy: [desc(workoutSessions.date)],
      ...pagination(request),
    });

    return NextResponse.json({ workouts });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "workouts",
      key: session.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = workoutSessionInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid workout payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    if (isDemoUser(session.user.id) || !isDatabaseConfigured) {
      return NextResponse.json({ message: "Workout recorded (demo mode)", sessionId: nanoid() });
    }

    const { sessionId: savedSessionId, replayed } = await saveWorkoutSession(session.user.id, data);
    const sessionId = savedSessionId;
    const [achievementState, coachAgent] = await Promise.all([
      ensureAchievements(session.user.id).catch(() => ({ awards: [] })),
      updateCoachMemory(session.user.id).catch(() => null),
    ]);
    const unlockedCount = achievementState.awards.length;

    return NextResponse.json({ message: "Workout created successfully", sessionId, achievementsUnlocked: unlockedCount, coachAgent, replayed });
  } catch (error) {
    return apiError(error, request);
  }
}
