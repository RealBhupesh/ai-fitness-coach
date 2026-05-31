import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseReps, sessionFeedbackEvents, workoutExercises, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { updateCoachMemory } from "@/lib/server/coach-agent";
import { ensureAchievements } from "@/lib/server/app-data";
import { workoutSessionInputSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json({ workouts: [] });
    }
    const workouts = await db.query.workoutSessions.findMany({
      where: eq(workoutSessions.userId, session.user.id),
      orderBy: [desc(workoutSessions.date)],
      limit: 100,
    });

    return NextResponse.json({ workouts });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "workouts",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = workoutSessionInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid workout payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const sessionId = nanoid();

    if (isDemoUser(session.user.id)) {
      return NextResponse.json({ message: "Workout recorded (demo mode)", sessionId });
    }

    await db.insert(workoutSessions).values({
      id: sessionId,
      userId: session.user.id,
      type: data.type,
      exerciseType: data.exerciseType,
      date: new Date(),
      duration: data.duration,
      caloriesBurned: data.caloriesBurned,
      completed: true,
      compositeScore: data.compositeScore,
      scoringBreakdown: toJson(data.scoringBreakdown),
      summary: data.summary,
      totalReps: data.totalReps,
      avgRepDurationMs:
        data.repData.length > 0
          ? Math.round(data.repData.reduce((sum, rep) => sum + rep.durationMs, 0) / data.repData.length)
          : 0,
      fatigueCurve: toJson(data.fatigueCurve),
      frameQualityStats: data.sessionAnalysis ? toJson(data.sessionAnalysis.frameQualityStats) : null,
      issueHistory: data.sessionAnalysis ? toJson(data.sessionAnalysis.issueHistory) : null,
      phaseHistory: data.sessionAnalysis ? toJson(data.sessionAnalysis.phaseHistory) : null,
      telemetry: data.sessionAnalysis ? toJson(data.sessionAnalysis.telemetry) : null,
      postSetAnalysis: data.sessionAnalysis ? toJson(data.sessionAnalysis.postSet) : null,
      createdAt: new Date(),
    });

    if (data.exercises.length) {
      await db.insert(workoutExercises).values(
        data.exercises.map((exercise, index) => ({
          id: nanoid(),
          sessionId,
          exerciseId: exercise.exerciseId,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          duration: exercise.duration,
          completed: true,
          formScore: exercise.formScore,
          romScore: exercise.romScore,
          tempoScore: exercise.tempoScore,
          safetyScore: exercise.safetyScore,
          corrections: toJson(exercise.corrections),
          order: index,
        })),
      );
    }

    if (data.repData.length) {
      await db.insert(exerciseReps).values(
        data.repData.map((rep) => ({
          id: nanoid(),
          sessionId,
          exerciseId: rep.exerciseId,
          repNumber: rep.repNumber,
          phase: rep.phase,
          formScore: rep.formScore,
          romScore: rep.romScore,
          tempoScore: rep.tempoScore,
          safetyScore: rep.safetyScore,
          corrections: toJson(rep.corrections),
          durationMs: rep.durationMs,
          timestamps: rep.timestamps ? toJson(rep.timestamps) : null,
          curlScorecard: rep.curlScorecard ? toJson(rep.curlScorecard) : null,
          squatScorecard: rep.squatScorecard ? toJson(rep.squatScorecard) : null,
          createdAt: new Date(),
        })),
      );
    }

    if (data.feedbackEvents.length) {
      await db.insert(sessionFeedbackEvents).values(
        data.feedbackEvents.map((event) => ({
          id: nanoid(),
          sessionId,
          timestamp: event.timestamp,
          type: event.type,
          message: event.message,
          severity: event.severity,
          source: event.source,
          createdAt: new Date(),
        })),
      );
    }

    const [achievementState, coachAgent] = await Promise.all([
      ensureAchievements(session.user.id),
      updateCoachMemory(session.user.id).catch(() => null),
    ]);
    const unlockedCount = achievementState.awards.length;

    return NextResponse.json({ message: "Workout created successfully", sessionId, achievementsUnlocked: unlockedCount, coachAgent });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to create workout" }, { status });
  }
}
