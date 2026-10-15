import { apiError } from "@/lib/server/api";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { exerciseReps, sessionFeedbackEvents, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { buildReviewLabReport, summarizeReviewLabReport } from "@/lib/review-lab/evidence";
import { getDemoReviewLabReports } from "@/lib/review-lab/demo-fixtures";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id) || !isDatabaseConfigured) {
      return NextResponse.json({ sessions: getDemoReviewLabReports().map(summarizeReviewLabReport) });
    }

    const sessions = await db.query.workoutSessions.findMany({
      where: eq(workoutSessions.userId, session.user.id),
      orderBy: [desc(workoutSessions.date)],
      limit: 50,
    });

    const reports = await Promise.all(
      sessions.map(async (item) => {
        const [reps, events] = await Promise.all([
          db.query.exerciseReps.findMany({ where: eq(exerciseReps.sessionId, item.id) }),
          db.query.sessionFeedbackEvents.findMany({ where: eq(sessionFeedbackEvents.sessionId, item.id) }),
        ]);
        return summarizeReviewLabReport(buildReviewLabReport({ session: item, reps, feedbackEvents: events }));
      }),
    );

    return NextResponse.json({ sessions: reports });
  } catch (error) {
    return apiError(error, request);
  }
}
