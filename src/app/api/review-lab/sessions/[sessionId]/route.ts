import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseReps, sessionFeedbackEvents, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { buildReviewLabReport } from "@/lib/review-lab/evidence";
import { getDemoReviewLabReport } from "@/lib/review-lab/demo-fixtures";

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const authSession = await requireServerSession(request);
    const { sessionId } = await context.params;

    if (isDemoUser(authSession.user.id)) {
      const report = getDemoReviewLabReport(sessionId);
      return report ? NextResponse.json({ report }) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const workout = await db.query.workoutSessions.findFirst({
      where: and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, authSession.user.id)),
    });

    if (!workout) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [reps, events] = await Promise.all([
      db.query.exerciseReps.findMany({ where: eq(exerciseReps.sessionId, workout.id) }),
      db.query.sessionFeedbackEvents.findMany({ where: eq(sessionFeedbackEvents.sessionId, workout.id) }),
    ]);

    return NextResponse.json({ report: buildReviewLabReport({ session: workout, reps, feedbackEvents: events }) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
