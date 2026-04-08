import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { generateSessionSummary } from "@/lib/ai/coach";
import { getAppProfile } from "@/lib/server/app-data";
import { summarizeInputSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const parsed = summarizeInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid summary payload", details: parsed.error.flatten() }, { status: 400 });
    }

    let profile = null;
    let workoutText = "";
    let workoutId: string | null = null;

    try {
      const session = await requireServerSession(request);
      profile = await getAppProfile(session.user.id);
      if (parsed.data.sessionId) {
        const workout = await db.query.workoutSessions.findFirst({
          where: eq(workoutSessions.id, parsed.data.sessionId),
        });
        if (workout && workout.userId === session.user.id) {
          workoutId = workout.id;
          workoutText = `Type: ${workout.type}
Exercise: ${workout.exerciseType ?? "mixed"}
Duration: ${workout.duration ?? 0} minutes
Calories: ${workout.caloriesBurned ?? 0}
Composite score: ${workout.compositeScore ?? 0}
Breakdown: ${workout.scoringBreakdown ?? "none"}
Notes: ${workout.notes ?? "none"}`;
        }
      }
    } catch {
      // Demo mode: no authenticated server session.
    }

    if (!workoutText) {
      workoutText =
        parsed.data.sessionSummary ||
        `Type: ${parsed.data.exerciseType ?? "strength"}
Duration: ${parsed.data.durationMinutes ?? 0} minutes
Total reps: ${parsed.data.totalReps ?? 0}
Breakdown: ${parsed.data.scoringBreakdown ? JSON.stringify(parsed.data.scoringBreakdown) : "none"}
Top issues: ${(parsed.data.topIssues ?? []).join("; ") || "none"}
Top strengths: ${(parsed.data.topStrengths ?? []).join("; ") || "none"}`;
    }

    const summary = await generateSessionSummary({
      profile,
      sessionSummary: workoutText,
    });

    if (workoutId) {
      await db
        .update(workoutSessions)
        .set({
          summary: summary.summary,
        })
        .where(eq(workoutSessions.id, workoutId));
    }

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
