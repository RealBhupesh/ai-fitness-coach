import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { progressTracking, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { calculateStreak } from "@/lib/server/app-data";
import { progressInputSchema } from "@/lib/validation/schemas";
import { parseJsonObject, toJson } from "@/lib/utils/json";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (!isDatabaseConfigured) {
      return NextResponse.json({
        entries: [],
        streak: 5,
        totalSessions: 12,
        avgScore: 84,
      });
    }
    const [entries, workouts] = await Promise.all([
      db.query.progressTracking.findMany({
        where: eq(progressTracking.userId, session.user.id),
        orderBy: [desc(progressTracking.date)],
        limit: 50,
      }),
      db.query.workoutSessions.findMany({
        where: eq(workoutSessions.userId, session.user.id),
        orderBy: [desc(workoutSessions.date)],
        limit: 150,
      }),
    ]);

    const avgScore =
      workouts.length > 0
        ? Math.round(workouts.reduce((sum, workout) => sum + (workout.compositeScore ?? 0), 0) / workouts.length)
        : 0;

    return NextResponse.json({
      entries: entries.reverse().map((entry) => ({
        id: entry.id,
        date: entry.date.toISOString(),
        weight: entry.weight,
        bodyFat: entry.bodyFat,
        muscleMass: entry.muscleMass,
        measurements: parseJsonObject<Record<string, number>>(entry.measurements, {}),
        exerciseScores: parseJsonObject<Record<string, number>>(entry.exerciseScores, {}),
        adherence: entry.adherence ?? 0,
        notes: entry.notes,
      })),
      streak: calculateStreak(workouts.map((workout) => workout.date)),
      totalSessions: workouts.length,
      avgScore,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "progress",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = progressInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid progress payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    if (!isDatabaseConfigured) {
      return NextResponse.json({ message: "Progress saved successfully (demo mode)" });
    }

    await db.insert(progressTracking).values({
      id: nanoid(),
      userId: session.user.id,
      date: new Date(),
      weight: data.weight,
      bodyFat: data.bodyFat,
      muscleMass: data.muscleMass,
      measurements: data.measurements ? toJson(data.measurements) : null,
      exerciseScores: data.exerciseScores ? toJson(data.exerciseScores) : null,
      adherence: data.adherence,
      notes: data.notes,
      createdAt: new Date(),
    });

    return NextResponse.json({ message: "Progress saved successfully" });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to save progress" }, { status });
  }
}
