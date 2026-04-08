import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseReps, sessionFeedbackEvents, workoutExercises, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { workoutSessionInputSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
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
    const parsed = workoutSessionInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid workout payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const sessionId = nanoid();
    let sessionUserId: string | null = null;
    try {
      const session = await requireServerSession(request);
      sessionUserId = session.user.id;
    } catch {
      sessionUserId = null;
    }

    // Demo mode: accept session payload without DB persistence.
    if (!sessionUserId) {
      return NextResponse.json({
        message: "Workout captured in demo mode",
        sessionId,
        demoMode: true,
      });
    }

    await db.insert(workoutSessions).values({
      id: sessionId,
      userId: sessionUserId,
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

    return NextResponse.json({ message: "Workout created successfully", sessionId });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create workout" }, { status: 500 });
  }
}
