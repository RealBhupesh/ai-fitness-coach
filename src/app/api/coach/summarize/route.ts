import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { generateSessionSummary } from "@/lib/ai/coach";
import { getAppProfile } from "@/lib/server/app-data";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { summarizeInputSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "coach-summarize",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 12,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = summarizeInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid summary payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await getAppProfile(session.user.id);
    let workoutText = "";
    let workoutId: string | null = null;

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
      exerciseType: parsed.data.exerciseType,
    });

    if (workoutId) {
      await db
        .update(workoutSessions)
        .set({
          summary: summary.summary,
          summaryPayload: toJson(summary),
        })
        .where(eq(workoutSessions.id, workoutId));
    }

    return NextResponse.json(summary);
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to generate summary" }, { status });
  }
}
