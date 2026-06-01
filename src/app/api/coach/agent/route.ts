import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { getCoachAgentReport } from "@/lib/server/coach-agent";

const DEMO_REPORT = {
  memory: {
    weakMetrics: ["Knee tracking", "Timing"],
    strongMetrics: ["Torso control", "Arm hits"],
    recurringIssues: ["Drive both knees over the middle toes.", "Arrive earlier; you are chasing the count."],
    recommendedFocus: "Knee tracking",
    preferredNextAction: "practice",
  },
  todayPlan: {
    title: "Today's coach plan",
    primaryAction: "Start Squat technique set",
    primaryHref: "/coach/workout",
    secondaryAction: "Chase Squat Foundation",
    secondaryHref: "/achievements",
    evidenceChips: ["5 sessions", "420 calories", "weak: Knee tracking", "dance timing", "Squat Foundation: 44%"],
  },
  primarySessionRecommendation: {
    type: "workout",
    label: "Squat technique set",
    href: "/coach/workout",
    reason: "Demo memory shows knee tracking is the clearest fitness improvement lever.",
  },
  focusMetric: {
    label: "Knee tracking",
    target: "Knees track over middle toes",
    measuredValue: "Squat scorecard status",
    cue: "Slow the descent and press both knees toward the middle toes.",
  },
  closestAchievement: {
    name: "Squat Foundation",
    description: "Save 25 squat reps with scorecard evidence",
    category: "fitness",
    icon: "🦵",
    threshold: 25,
    progress: 11,
    remaining: 14,
    percent: 44,
    nextAction: "Save 14 more squat scorecard reps.",
  },
  preSessionBrief: {
    priority: "practice",
    reason: "Demo memory shows repeated knee-tracking and hip-hop timing issues.",
    evidence: ["5 demo reps", "hip-hop starter phrase evidence", "recurring weak metric: Knee tracking"],
    nextAction: "Before starting: run one squat technique set or repeat the hip-hop starter phrase with timing focus.",
    planAdjustment: "Keep difficulty steady and narrow feedback to one correction.",
    achievementRecommendation: "Squat Foundation: 25 scorecard reps to unlock.",
  },
  postSessionNextAction: {
    priority: "practice",
    reason: "Demo memory shows repeated technique misses.",
    evidence: ["scorecard evidence available", "timing evidence available"],
    nextAction: "Repeat the current module and focus on one weak metric.",
    planAdjustment: "Hold difficulty for one more session.",
    achievementRecommendation: "Squat Foundation: 25 scorecard reps to unlock.",
  },
  weeklyReport: {
    summary: "Demo week: practice focus is squat control plus hip-hop phrase timing.",
    evidence: ["Priority: practice", "Knee tracking needs attention", "Dance timing needs attention"],
    planAdjustment: "Alternate fitness technique and hip-hop practice sessions.",
  },
  achievementRecommendation: "Squat Foundation: 25 scorecard reps to unlock.",
};

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json(DEMO_REPORT);
    }
    const report = await getCoachAgentReport(session.user.id);
    return NextResponse.json(report);
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to load coach agent" }, { status });
  }
}
