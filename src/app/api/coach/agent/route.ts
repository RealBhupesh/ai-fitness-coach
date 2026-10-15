import { apiError } from "@/lib/server/api";
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
  readiness: {
    score: 76,
    label: "Ready",
    recommendation: "Train normally and keep one focus metric in view.",
    drivers: ["7.3h sleep signal", "energy 4/5", "12 recovery debt", "form limiter: Knee tracking"],
    recoveryDebt: 12,
  },
  strainLoad: {
    todayStrain: 7,
    weeklyLoad: 38,
    label: "Balanced",
    targetRange: "25-50 this week",
    explanation: "Training load is in a productive maintenance and skill-building zone.",
  },
  weeklyAdaptivePlan: [
    { day: "Mon", label: "Squat technique", type: "workout", duration: 20, intensity: "moderate", href: "/coach/workout", reason: "Coach focus: Knee tracking." },
    { day: "Tue", label: "Mobility reset", type: "mobility", duration: 15, intensity: "low", href: "/recovery", reason: "Keep joints fresh while preserving consistency." },
    { day: "Wed", label: "Hip-hop timing", type: "dance", duration: 18, intensity: "moderate", href: "/coach/dance", reason: "Dance timing needs one clean phrase." },
    { day: "Thu", label: "Base builder", type: "workout", duration: 22, intensity: "moderate", href: "/coach/workout", reason: "Hold the plan steady with one clear target." },
    { day: "Fri", label: "Achievement chase", type: "workout", duration: 20, intensity: "moderate", href: "/coach/workout", reason: "Save 14 more squat scorecard reps." },
    { day: "Sat", label: "Mobility reset", type: "mobility", duration: 15, intensity: "low", href: "/recovery", reason: "Protect recovery before the next session." },
    { day: "Sun", label: "Progression session", type: "dance", duration: 24, intensity: "high", href: "/coach/dance", reason: "Blend fitness control with rhythm." },
  ],
  bodyBattery: [
    { time: "06:00", energy: 84, label: "wake" },
    { time: "09:00", energy: 80, label: "prime focus" },
    { time: "12:00", energy: 73, label: "midday" },
    { time: "16:00", energy: 65, label: "train window" },
    { time: "20:00", energy: 52, label: "downshift" },
  ],
  smartAlerts: [
    { title: "Squat Foundation is close", message: "Save 14 more squat scorecard reps.", href: "/achievements", severity: "success" },
    { title: "Streak protection", message: "Ten focused minutes is enough to keep coach memory warm.", href: "/coach/workout", severity: "info" },
  ],
  trendInsights: [
    { label: "Form trend", value: "82/100", trend: "up", detail: "Compared with prior sessions." },
    { label: "Calorie burn", value: "140 avg", trend: "flat", detail: "Uses saved workout and dance calorie estimates." },
    { label: "Modality balance", value: "3:2", trend: "flat", detail: "Strength to dance ratio across recent coach memory." },
  ],
  wearableIntegrations: [
    { name: "Apple Health", status: "planned", signal: "sleep, steps, active energy" },
    { name: "Google Fit", status: "planned", signal: "activity minutes, calories, heart points" },
    { name: "Fitbit / WHOOP imports", status: "planned", signal: "recovery, HRV, resting heart rate" },
  ],
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
    return apiError(error, request);
  }
}
