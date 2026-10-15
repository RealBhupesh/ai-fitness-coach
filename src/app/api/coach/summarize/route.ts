import { apiError, readJson, ApiError } from "@/lib/server/api";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { generateSessionSummary } from "@/lib/ai/coach";
import { getAppProfile } from "@/lib/server/app-data";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { summarizeInputSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "coach-summarize",
      key: session.user.id,
      limit: 12,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = summarizeInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid summary payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await getAppProfile(session.user.id);
    let workoutText = "";
    let workoutId: string | null = null;

    if (parsed.data.sessionId && !isDemoUser(session.user.id) && isDatabaseConfigured) {
      const workout = await db.query.workoutSessions.findFirst({
        where: and(eq(workoutSessions.id, parsed.data.sessionId),eq(workoutSessions.userId,session.user.id)),
      });
      if (!workout) throw new ApiError(404,"SESSION_NOT_FOUND","Session not found");
      if (workout) {
        workoutId = workout.id;
        workoutText = `Type: ${workout.type}
Exercise: ${workout.exerciseType ?? "mixed"}
Duration: ${workout.duration ?? 0} minutes
Calories: ${workout.caloriesBurned ?? 0}
Composite score: ${workout.compositeScore ?? 0}
Breakdown: ${workout.scoringBreakdown ?? "none"}
Frame quality stats: ${workout.frameQualityStats ?? "none"}
Issue history: ${workout.issueHistory ?? "none"}
Phase history: ${workout.phaseHistory ?? "none"}
Post-set analysis: ${workout.postSetAnalysis ?? "none"}
Telemetry: ${workout.telemetry ?? "none"}
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
      signal: request.signal,
      profile,
      sessionSummary: workoutText,
      exerciseType: parsed.data.exerciseType,
      coachingLevel: parsed.data.coachingLevel,
      curlEvidence: parsed.data.curlEvidence,
      curlCoachMemory: parsed.data.curlCoachMemory,
    });

    if (workoutId && !isDemoUser(session.user.id) && isDatabaseConfigured) {
      await db
        .update(workoutSessions)
        .set({
          summary: summary.summary,
          summaryPayload: toJson(summary),
        })
        .where(and(eq(workoutSessions.id, workoutId),eq(workoutSessions.userId,session.user.id)));
    }

    return NextResponse.json(summary);
  } catch (error) {
    return apiError(error, request);
  }
}
