import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { workoutSessions, workoutExercises, exerciseReps, sessionFeedbackEvents, exercises } from "@/db/schema";
import { workoutSessionInputSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";
import { ApiError } from "@/lib/server/api";
import { loadPrimaryDanceRoutinePack } from "@/lib/dance/routine-pack";
import { recordDanceCourseAttempt } from "@/lib/server/dance-course";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  return "{" + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ":" + canonicalJson(v)).join(",") + "}";
}

export async function saveWorkoutSession(userId: string, data: z.infer<typeof workoutSessionInputSchema>, database = db) {
  const payloadHash = createHash("sha256").update(canonicalJson(data)).digest("hex");
  return database.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId + ":" + data.clientSessionId}, 0))`);
    const existing = await tx.query.workoutSessions.findFirst({ where: and(eq(workoutSessions.userId, userId), eq(workoutSessions.clientSessionId, data.clientSessionId)) });
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new ApiError(409, "SESSION_CONFLICT", "This session was already saved with different data");
      return { sessionId: existing.id, replayed: true };
    }
    const names: Record<string,string> = { squat: "Squats", pushup: "Push-ups", lunge: "Lunges", bicep_curl: "Bicep Curl", jumping_jack: "Jumping Jacks", plank: "Plank", warrior: "Warrior", dance_basic: "Dance Frame" };
    const ids = [...new Set([...data.exercises.map(e=>e.exerciseId), ...data.repData.map(e=>e.exerciseId)])];
    const exerciseIds = new Map<string,string>();
    for (const id of ids) {
      const row = await tx.query.exercises.findFirst({ where: names[id] ? eq(exercises.name, names[id]) : eq(exercises.id, id) });
      if (!row) throw new ApiError(400, "UNKNOWN_EXERCISE", "Exercise catalog unavailable. Retry after the catalog is seeded.");
      exerciseIds.set(id,row.id);
    }
    const sessionId = nanoid();
    await tx.insert(workoutSessions).values({
      id: sessionId,
      userId,
      clientSessionId: data.clientSessionId,
      payloadHash,
      modelEvidence: data.modelEvidence ? toJson(data.modelEvidence) : null,
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
      await tx.insert(workoutExercises).values(
        data.exercises.map((exercise, index) => ({
          id: nanoid(),
          sessionId,
          exerciseId: exerciseIds.get(exercise.exerciseId)!,
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
      await tx.insert(exerciseReps).values(
        data.repData.map((rep) => ({
          id: nanoid(),
          sessionId,
          exerciseId: exerciseIds.get(rep.exerciseId)!,
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
      await tx.insert(sessionFeedbackEvents).values(
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

    if (data.type === "dance" && data.danceSegments.length) {
      const routine = await loadPrimaryDanceRoutinePack();
      for (const segment of data.danceSegments) {
        await recordDanceCourseAttempt(userId, {
          routineId: routine.id,
          segmentId: segment.id,
          mode: "full_routine",
          sourceSessionId: sessionId,
          score: segment.overall,
          reliability: segment.reliability,
          timingScore: segment.timing,
          transitionScore: segment.transition,
          durationSeconds: data.duration * 60,
          notes: segment.label,
        }, tx);
      }
    }

    return { sessionId, replayed: false };
  });
}
