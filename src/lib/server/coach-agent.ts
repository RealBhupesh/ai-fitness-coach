import { desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, isDatabaseConfigured } from "@/db";
import { coachMemories, exerciseReps, progressTracking, userProfiles, workoutSessions } from "@/db/schema";
import { buildAchievementProgress, ensureAchievements } from "@/lib/server/app-data";
import { parseJsonArray, parseJsonObject, toJson } from "@/lib/utils/json";

export type CoachDecisionPriority = "recover" | "practice" | "progress" | "repeat" | "celebrate";

export type CoachDecision = {
  priority: CoachDecisionPriority;
  reason: string;
  evidence: string[];
  nextAction: string;
  planAdjustment?: string;
  achievementRecommendation?: string;
};

export type CoachAgentReport = {
  memory: {
    weakMetrics: string[];
    strongMetrics: string[];
    recurringIssues: string[];
    recommendedFocus: string;
    preferredNextAction: CoachDecisionPriority;
  };
  todayPlan: {
    title: string;
    primaryAction: string;
    primaryHref: string;
    secondaryAction: string;
    secondaryHref: string;
    evidenceChips: string[];
  };
  primarySessionRecommendation: {
    type: "workout" | "dance" | "recovery";
    label: string;
    href: string;
    reason: string;
  };
  focusMetric: {
    label: string;
    target: string;
    measuredValue: string;
    cue: string;
  };
  closestAchievement: ClosestAchievement;
  preSessionBrief: CoachDecision;
  postSessionNextAction: CoachDecision;
  weeklyReport: {
    summary: string;
    evidence: string[];
    planAdjustment: string;
  };
  readiness: ReadinessReport;
  strainLoad: StrainLoadReport;
  weeklyAdaptivePlan: WeeklyAdaptivePlanDay[];
  bodyBattery: BodyBatteryPoint[];
  smartAlerts: SmartAlert[];
  trendInsights: TrendInsight[];
  wearableIntegrations: WearableIntegration[];
  achievementRecommendation: string;
};

export type ClosestAchievement = {
  name: string;
  description: string;
  category: string;
  icon: string | null;
  threshold: number;
  progress: number;
  remaining: number;
  percent: number;
  nextAction: string;
} | null;

type SessionLike = {
  id: string;
  type: string;
  exerciseType: string | null;
  date: Date;
  duration: number | null;
  caloriesBurned: number | null;
  compositeScore: number | null;
  totalReps: number | null;
  issueHistory: string | null;
  postSetAnalysis: string | null;
};

type RepLike = {
  curlScorecard?: string | null;
  squatScorecard?: string | null;
};

export type RecoveryCheckIn = {
  sleepHours?: number;
  sleepQuality?: number;
  soreness?: number;
  stress?: number;
  energy?: number;
  hydration?: number;
  mood?: string;
  notes?: string;
  loggedAt?: string;
};

export type ReadinessReport = {
  score: number;
  label: "Prime" | "Ready" | "Manage" | "Recover";
  recommendation: string;
  drivers: string[];
  recoveryDebt: number;
};

export type StrainLoadReport = {
  todayStrain: number;
  weeklyLoad: number;
  label: "Low" | "Balanced" | "High" | "Overreaching";
  targetRange: string;
  explanation: string;
};

export type WeeklyAdaptivePlanDay = {
  day: string;
  label: string;
  type: "workout" | "dance" | "recovery" | "mobility";
  duration: number;
  intensity: "low" | "moderate" | "high";
  reason: string;
  href: string;
};

export type BodyBatteryPoint = {
  time: string;
  energy: number;
  label: string;
};

export type SmartAlert = {
  title: string;
  message: string;
  href: string;
  severity: "info" | "warning" | "success";
};

export type TrendInsight = {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  detail: string;
};

export type WearableIntegration = {
  name: string;
  status: "planned" | "ready";
  signal: string;
};

function countBy(values: string[]) {
  return values.reduce((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
}

function topValues(values: string[], limit = 4) {
  return Array.from(countBy(values).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function scorecardLabels(rep: RepLike, status: "fail" | "warning" | "pass") {
  const labels: string[] = [];
  [rep.curlScorecard, rep.squatScorecard].forEach((raw) => {
    const scorecard = parseJsonObject<any>(raw, null);
    if (!scorecard?.metrics) return;
    Object.values(scorecard.metrics as Record<string, any>).forEach((metric) => {
      if (metric?.status === status && metric?.label) labels.push(String(metric.label));
    });
  });
  return labels;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function daysAgo(date: Date) {
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

function parseRecoveryCheckIn(value: string | null): RecoveryCheckIn | null {
  const parsed = parseJsonObject<any>(value, null);
  const checkIn = parsed?.recoveryCheckIn;
  if (!checkIn || typeof checkIn !== "object") return null;
  return checkIn as RecoveryCheckIn;
}

function sessionStrain(session: SessionLike) {
  const calories = session.caloriesBurned ?? 0;
  const duration = session.duration ?? 0;
  const reps = session.totalReps ?? 0;
  const score = session.compositeScore ?? 70;
  const typeMultiplier = session.type === "dance" ? 1.05 : session.type === "strength" ? 1.15 : 0.85;
  return clamp((calories / 42 + duration * 0.1 + reps * 0.035 + Math.max(0, score - 70) * 0.035) * typeMultiplier, 0, 21);
}

export function buildStrainLoadReport(sessions: SessionLike[]): StrainLoadReport {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayStrain = sessions
    .filter((session) => session.date.toISOString().slice(0, 10) === todayKey)
    .reduce((sum, session) => sum + sessionStrain(session), 0);
  const weeklyLoad = sessions
    .filter((session) => daysAgo(session.date) <= 7)
    .reduce((sum, session) => sum + sessionStrain(session), 0);
  const roundedToday = Math.round(clamp(todayStrain, 0, 21));
  const roundedWeek = Math.round(weeklyLoad);
  const label = roundedWeek >= 72 ? "Overreaching" : roundedWeek >= 50 ? "High" : roundedWeek >= 22 ? "Balanced" : "Low";

  return {
    todayStrain: roundedToday,
    weeklyLoad: roundedWeek,
    label,
    targetRange: label === "Overreaching" ? "22-45 this week" : label === "High" ? "35-55 this week" : "25-50 this week",
    explanation:
      label === "Overreaching"
        ? "Your recent training stress is above the productive range, so the coach should protect recovery."
        : label === "High"
          ? "Training load is high enough to improve fitness if recovery stays strong."
          : label === "Balanced"
            ? "Training load is in a productive maintenance and skill-building zone."
            : "Load is low, so a short coached session will help rebuild momentum.",
  };
}

export function buildReadinessReport(input: {
  sessions: SessionLike[];
  sleepHours?: number | null;
  recoveryCheckIn?: RecoveryCheckIn | null;
  failedMetrics: string[];
}): ReadinessReport {
  const checkIn = input.recoveryCheckIn;
  const sleepHours = checkIn?.sleepHours ?? input.sleepHours ?? 7;
  const sleepScore = clamp((sleepHours / 8) * 28, 0, 30);
  const energyScore = checkIn?.energy ? clamp(checkIn.energy * 5, 5, 25) : 17;
  const sorenessPenalty = checkIn?.soreness ? clamp(checkIn.soreness * 3, 0, 24) : 4;
  const stressPenalty = checkIn?.stress ? clamp(checkIn.stress * 2.5, 0, 20) : 3;
  const recentLoad = input.sessions.filter((session) => daysAgo(session.date) <= 3).reduce((sum, session) => sum + sessionStrain(session), 0);
  const recoveryDebt = Math.round(clamp(recentLoad + sorenessPenalty + stressPenalty - sleepScore, 0, 60));
  const formPenalty = input.failedMetrics.length >= 3 ? 10 : input.failedMetrics.length ? 4 : 0;
  const score = Math.round(clamp(55 + sleepScore + energyScore - sorenessPenalty - stressPenalty - recentLoad * 0.45 - formPenalty, 1, 100));
  const label = score >= 85 ? "Prime" : score >= 70 ? "Ready" : score >= 50 ? "Manage" : "Recover";
  const drivers = [
    `${sleepHours.toFixed(1)}h sleep signal`,
    checkIn?.energy ? `energy ${checkIn.energy}/5` : "energy baseline estimated",
    recoveryDebt ? `${recoveryDebt} recovery debt` : "low recovery debt",
    input.failedMetrics[0] ? `form limiter: ${input.failedMetrics[0]}` : "no major weak metric",
  ];

  return {
    score,
    label,
    drivers,
    recoveryDebt,
    recommendation:
      label === "Prime"
        ? "Push skill or intensity while keeping camera reliability high."
        : label === "Ready"
          ? "Train normally and keep one focus metric in view."
          : label === "Manage"
            ? "Use technique practice, hip-hop timing, or a shorter session."
            : "Prioritize mobility, recovery, and a light form reset today.",
  };
}

export function buildWeeklyAdaptivePlan(input: {
  readiness: ReadinessReport;
  strainLoad: StrainLoadReport;
  decision: CoachDecision;
  focusMetric: { label: string };
  closestAchievement: ClosestAchievement;
}): WeeklyAdaptivePlanDay[] {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const shouldRecover = input.readiness.score < 55 || input.strainLoad.label === "Overreaching";
  const chaseDance = /timing|beat|groove/i.test(input.focusMetric.label);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    if (index === 0 && shouldRecover) {
      return {
        day: dayNames[date.getDay()],
        label: "Recovery reset",
        type: "recovery" as const,
        duration: 12,
        intensity: "low" as const,
        href: "/recovery",
        reason: "Readiness is low enough to protect tomorrow's training quality.",
      };
    }
    if (index === 1 || (chaseDance && index === 3)) {
      return {
        day: dayNames[date.getDay()],
        label: chaseDance ? "Hip-hop timing block" : "Weak metric practice",
        type: chaseDance ? "dance" as const : "workout" as const,
        duration: 18,
        intensity: "moderate" as const,
        href: chaseDance ? "/coach/dance" : "/coach/workout",
        reason: `Coach focus: ${input.focusMetric.label}.`,
      };
    }
    if (index === 2 || index === 5) {
      return {
        day: dayNames[date.getDay()],
        label: "Mobility + tissue prep",
        type: "mobility" as const,
        duration: 15,
        intensity: "low" as const,
        href: "/recovery",
        reason: "Keep joints fresh while preserving consistency.",
      };
    }
    if (index === 4 && input.closestAchievement) {
      return {
        day: dayNames[date.getDay()],
        label: `Achievement chase`,
        type: input.closestAchievement.category === "dance" ? "dance" as const : "workout" as const,
        duration: 22,
        intensity: "moderate" as const,
        href: input.closestAchievement.category === "dance" ? "/coach/dance" : "/coach/workout",
        reason: input.closestAchievement.nextAction,
      };
    }
    return {
      day: dayNames[date.getDay()],
      label: input.decision.priority === "progress" ? "Progression session" : "Base builder",
      type: chaseDance ? "dance" as const : "workout" as const,
      duration: input.decision.priority === "progress" ? 28 : 20,
      intensity: input.decision.priority === "progress" && input.readiness.score >= 70 ? "high" as const : "moderate" as const,
      href: chaseDance ? "/coach/dance" : "/coach/workout",
      reason: input.decision.planAdjustment ?? "Hold the plan steady with one clear coaching target.",
    };
  });
}

export function buildBodyBattery(input: { readiness: ReadinessReport; strainLoad: StrainLoadReport }): BodyBatteryPoint[] {
  const start = clamp(input.readiness.score + 8, 20, 100);
  const drain = input.strainLoad.todayStrain * 1.6;
  return [
    { time: "06:00", energy: Math.round(start), label: "wake" },
    { time: "09:00", energy: Math.round(clamp(start - 4, 1, 100)), label: "prime focus" },
    { time: "12:00", energy: Math.round(clamp(start - 10, 1, 100)), label: "midday" },
    { time: "16:00", energy: Math.round(clamp(start - drain, 1, 100)), label: "train window" },
    { time: "20:00", energy: Math.round(clamp(start - drain - 12, 1, 100)), label: "downshift" },
  ];
}

export function buildSmartAlerts(input: {
  readiness: ReadinessReport;
  strainLoad: StrainLoadReport;
  closestAchievement: ClosestAchievement;
  weeklyPlan: WeeklyAdaptivePlanDay[];
  sessions: SessionLike[];
}): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (input.readiness.score < 55) {
    alerts.push({
      title: "Recovery first",
      message: `Readiness is ${input.readiness.score}. Swap intensity for mobility or a light technique reset.`,
      href: "/recovery",
      severity: "warning",
    });
  } else if (input.strainLoad.weeklyLoad < 20) {
    alerts.push({
      title: "Momentum window",
      message: "Your weekly load is low. A short coached session will restart the streak without overdoing it.",
      href: input.weeklyPlan[0]?.href ?? "/coach/workout",
      severity: "info",
    });
  }
  if (input.closestAchievement) {
    alerts.push({
      title: `${input.closestAchievement.name} is close`,
      message: input.closestAchievement.nextAction,
      href: "/achievements",
      severity: "success",
    });
  }
  const trainedToday = input.sessions.some((session) => session.date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10));
  if (!trainedToday) {
    alerts.push({
      title: "Streak protection",
      message: "No saved session today yet. Ten focused minutes is enough to keep coach memory warm.",
      href: "/coach/workout",
      severity: "info",
    });
  }
  return alerts.slice(0, 3);
}

export function buildTrendInsights(sessions: SessionLike[]): TrendInsight[] {
  const recent = sessions.slice(0, 5);
  const previous = sessions.slice(5, 10);
  const avg = (items: SessionLike[], key: "compositeScore" | "caloriesBurned") =>
    items.length ? items.reduce((sum, session) => sum + (session[key] ?? 0), 0) / items.length : 0;
  const recentScore = avg(recent, "compositeScore");
  const previousScore = avg(previous, "compositeScore");
  const recentCalories = avg(recent, "caloriesBurned");
  const previousCalories = avg(previous, "caloriesBurned");
  const danceCount = sessions.filter((session) => session.type === "dance").length;
  const strengthCount = sessions.filter((session) => session.type === "strength").length;
  return [
    {
      label: "Form trend",
      value: recentScore ? `${Math.round(recentScore)}/100` : "Baseline",
      trend: recentScore > previousScore + 2 ? "up" : recentScore < previousScore - 2 ? "down" : "flat",
      detail: previous.length ? `Compared with prior ${previous.length} sessions.` : "More sessions will unlock a stronger trend.",
    },
    {
      label: "Calorie burn",
      value: recentCalories ? `${Math.round(recentCalories)} avg` : "No data",
      trend: recentCalories > previousCalories + 10 ? "up" : recentCalories < previousCalories - 10 ? "down" : "flat",
      detail: "Uses saved workout and dance calorie estimates.",
    },
    {
      label: "Modality balance",
      value: `${strengthCount}:${danceCount}`,
      trend: Math.abs(strengthCount - danceCount) <= 1 ? "flat" : strengthCount > danceCount ? "up" : "down",
      detail: "Strength to dance ratio across recent coach memory.",
    },
  ];
}

export function buildCoachDecision(input: {
  recentSessions: SessionLike[];
  reps: RepLike[];
  achievementRecommendation: string;
}): CoachDecision {
  const sessions = input.recentSessions;
  const latest = sessions[0];
  const averageScore = sessions.length ? Math.round(sessions.reduce((sum, session) => sum + (session.compositeScore ?? 0), 0) / sessions.length) : 0;
  const totalCalories = sessions.reduce((sum, session) => sum + (session.caloriesBurned ?? 0), 0);
  const failedMetrics = topValues(input.reps.flatMap((rep) => scorecardLabels(rep, "fail")));
  const strongMetrics = topValues(input.reps.flatMap((rep) => scorecardLabels(rep, "pass")));
  const recentDance = sessions.filter((session) => session.type === "dance").length;
  const recentStrength = sessions.filter((session) => session.type === "strength").length;
  const evidence = [
    `${sessions.length} recent sessions`,
    `${totalCalories} recent calories`,
    averageScore ? `average score ${averageScore}` : "no score history yet",
    failedMetrics.length ? `weakest metric: ${failedMetrics[0]}` : "",
    latest?.exerciseType ? `latest exercise: ${latest.exerciseType}` : "",
  ].filter(Boolean);

  if (!sessions.length) {
    return {
      priority: "practice",
      reason: "No saved sessions yet, so the coach should gather baseline evidence first.",
      evidence: ["No workout or dance history found."],
      nextAction: "Start with a short squat, curl, or hip-hop starter session so the coach can learn from real evidence.",
      planAdjustment: "Keep the first session short and score-focused.",
      achievementRecommendation: input.achievementRecommendation,
    };
  }

  if (averageScore < 60 || failedMetrics.length >= 3) {
    return {
      priority: "recover",
      reason: "Recent evidence shows form quality is low or multiple metrics are failing.",
      evidence,
      nextAction: `Run a lighter technique session focused only on ${failedMetrics[0] ?? "setup quality"}.`,
      planAdjustment: "Do not increase difficulty until reliability and form scores recover.",
      achievementRecommendation: input.achievementRecommendation,
    };
  }

  if (failedMetrics.length) {
    return {
      priority: "practice",
      reason: "A repeated weak metric is limiting progress.",
      evidence,
      nextAction: `Repeat the last module and focus on ${failedMetrics[0]}.`,
      planAdjustment: "Keep volume steady and narrow feedback to one correction.",
      achievementRecommendation: input.achievementRecommendation,
    };
  }

  if (averageScore >= 85 && sessions.length >= 3) {
    return {
      priority: "progress",
      reason: "Recent scores are consistently strong.",
      evidence: [...evidence, strongMetrics.length ? `strongest metric: ${strongMetrics[0]}` : ""].filter(Boolean),
      nextAction: recentDance > recentStrength ? "Advance to the next hip-hop phrase pack or increase tempo slightly." : "Progress the next fitness session with one extra set or stricter coach level.",
      planAdjustment: "Increase challenge gradually while preserving reliability gates.",
      achievementRecommendation: input.achievementRecommendation,
    };
  }

  return {
    priority: "repeat",
    reason: "Recent work is stable but not ready for a bigger progression yet.",
    evidence,
    nextAction: latest?.type === "dance" ? "Repeat the hip-hop starter groove and improve timing consistency." : "Repeat the current fitness module and aim for a cleaner average score.",
    planAdjustment: "Hold the same difficulty for one more session.",
    achievementRecommendation: input.achievementRecommendation,
  };
}

function actionForAchievement(achievement: { name: string; category: string; remaining: number }) {
  const remaining = achievement.remaining;
  if (achievement.name === "First Steps") return "Complete one coached workout or hip-hop dance session.";
  if (achievement.name === "Week Warrior" || achievement.name === "Month Master") return `Train on ${remaining} more active day${remaining === 1 ? "" : "s"}.`;
  if (achievement.name === "Calorie Crusher") return `Burn ${remaining} more calories in saved sessions.`;
  if (achievement.name === "Rep Collector") return `Complete ${remaining} more counted live rep${remaining === 1 ? "" : "s"}.`;
  if (achievement.name === "Form Scholar") return `Finish ${remaining} more session${remaining === 1 ? "" : "s"} with a score of 85 or higher.`;
  if (achievement.name === "Curl Technician") return `Save ${remaining} more bicep curl scorecard rep${remaining === 1 ? "" : "s"}.`;
  if (achievement.name === "Squat Foundation") return `Save ${remaining} more squat scorecard rep${remaining === 1 ? "" : "s"}.`;
  if (achievement.name === "Hip-Hop Debut") return "Complete one hip-hop starter groove session.";
  if (achievement.name === "Groove Builder" || achievement.category === "dance") return `Complete ${remaining} more dance session${remaining === 1 ? "" : "s"} with timing evidence.`;
  if (achievement.category === "fitness") return `Complete ${remaining} more strength session${remaining === 1 ? "" : "s"}.`;
  return `Make ${remaining} more progress point${remaining === 1 ? "" : "s"} toward this milestone.`;
}

export function chooseFocusMetric(input: { failedMetrics: string[]; decision: CoachDecision; latest?: SessionLike | null }) {
  const label = input.failedMetrics[0] ?? (input.latest?.type === "dance" ? "Beat timing" : "Setup quality");
  if (/timing|beat|groove/i.test(label)) {
    return {
      label,
      target: "Arrive within the phrase window",
      measuredValue: "Timing consistency from dance checkpoints",
      cue: "Count the beat out loud for the first phrase, then move on the count instead of after it.",
    };
  }
  if (/knee/i.test(label)) {
    return {
      label,
      target: "Knees track over middle toes",
      measuredValue: "Knee-tracking scorecard status",
      cue: "Slow the descent and press both knees toward the middle toes.",
    };
  }
  if (/elbow/i.test(label)) {
    return {
      label,
      target: "Elbow stays beside the ribs",
      measuredValue: "Elbow-path scorecard status",
      cue: "Pin the elbow before the curl and keep the upper arm still.",
    };
  }
  if (/torso|stability|stack/i.test(label)) {
    return {
      label,
      target: "Torso remains stacked and quiet",
      measuredValue: "Torso stability score",
      cue: "Brace the ribs and move only through the working joints.",
    };
  }
  return {
    label,
    target: "Reliable camera plus controlled movement",
    measuredValue: input.decision.evidence.find((item) => /score|metric/i.test(item)) ?? "No measurement yet",
    cue: "Move slower for the first minute so the coach can lock onto clean evidence.",
  };
}

export function buildGuidedCoachPlan(input: {
  decision: CoachDecision;
  sessions: SessionLike[];
  failedMetrics: string[];
  closestAchievement: ClosestAchievement;
}) {
  const latest = input.sessions[0];
  const recentDance = input.sessions.filter((session) => session.type === "dance").length;
  const recentStrength = input.sessions.filter((session) => session.type === "strength").length;
  const totalCalories = input.sessions.reduce((sum, session) => sum + (session.caloriesBurned ?? 0), 0);
  const averageScore = input.sessions.length
    ? Math.round(input.sessions.reduce((sum, session) => sum + (session.compositeScore ?? 0), 0) / input.sessions.length)
    : 0;
  const focusMetric = chooseFocusMetric({ failedMetrics: input.failedMetrics, decision: input.decision, latest });
  const shouldDance = input.decision.priority === "progress" ? recentDance >= recentStrength : latest?.type === "dance" || /timing|dance|hip-hop/i.test(focusMetric.label);
  const recommendation =
    input.decision.priority === "recover"
      ? {
          type: "recovery" as const,
          label: "Technique reset",
          href: "/coach/workout",
          reason: "Recent scores or failed metrics suggest lighter practice before progression.",
        }
      : shouldDance
        ? {
            type: "dance" as const,
            label: "Hip-hop starter groove",
            href: "/coach/dance",
            reason: "Dance timing or recent dance evidence is the clearest next coaching signal.",
          }
        : {
            type: "workout" as const,
            label: focusMetric.label.toLowerCase().includes("elbow") ? "Bicep curl technique" : "Squat technique set",
            href: "/coach/workout",
            reason: "Fitness scorecards show this is the best place to improve form quality.",
          };

  const evidenceChips = [
    `${input.sessions.length} sessions`,
    `${totalCalories} calories`,
    averageScore ? `avg score ${averageScore}` : "baseline needed",
    input.failedMetrics[0] ? `weak: ${input.failedMetrics[0]}` : "",
    input.closestAchievement ? `${input.closestAchievement.name}: ${input.closestAchievement.percent}%` : "",
  ].filter(Boolean);

  return {
    focusMetric,
    primarySessionRecommendation: recommendation,
    todayPlan: {
      title: input.sessions.length ? "Today's coach plan" : "Start your first coached baseline",
      primaryAction: `Start ${recommendation.label}`,
      primaryHref: recommendation.href,
      secondaryAction:
        input.decision.priority === "recover"
          ? "Review progress"
          : input.closestAchievement
            ? `Chase ${input.closestAchievement.name}`
            : "Ask coach",
      secondaryHref: input.closestAchievement ? "/achievements" : "/coach/chat",
      evidenceChips,
    },
  };
}

function weeklyReport(sessions: SessionLike[], decision: CoachDecision) {
  const calories = sessions.reduce((sum, session) => sum + (session.caloriesBurned ?? 0), 0);
  const reps = sessions.reduce((sum, session) => sum + (session.totalReps ?? 0), 0);
  const dance = sessions.filter((session) => session.type === "dance").length;
  const strength = sessions.filter((session) => session.type === "strength").length;
  return {
    summary: `This week: ${sessions.length} sessions, ${calories} calories, ${reps} counted reps, ${strength} strength sessions, ${dance} dance sessions.`,
    evidence: [`Priority: ${decision.priority}`, decision.reason, ...decision.evidence],
    planAdjustment: decision.planAdjustment ?? "Keep the current plan steady until more evidence is available.",
  };
}

async function loadAgentEvidence(userId: string) {
  if (!isDatabaseConfigured) {
    return {
      sessions: [] as SessionLike[],
      reps: [] as RepLike[],
      profile: null,
      recoveryCheckIn: null,
    };
  }

  const [sessions, profile, progress] = await Promise.all([
    db.query.workoutSessions.findMany({
      where: eq(workoutSessions.userId, userId),
      orderBy: [desc(workoutSessions.date)],
      limit: 20,
    }),
    db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) }),
    db.query.progressTracking.findMany({
      where: eq(progressTracking.userId, userId),
      orderBy: [desc(progressTracking.date)],
      limit: 8,
    }),
  ]);
  const sessionIds = sessions.map((session) => session.id);
  const reps = sessionIds.length
    ? await db.query.exerciseReps.findMany({
        where: inArray(exerciseReps.sessionId, sessionIds),
      })
    : [];
  const recoveryCheckIn = progress.map((item) => parseRecoveryCheckIn(item.notes)).find(Boolean) ?? null;
  return { sessions, reps, profile, recoveryCheckIn };
}

async function closestAchievement(userId: string): Promise<ClosestAchievement> {
  const { allAchievements, awards, stats } = await ensureAchievements(userId);
  const awarded = new Set(awards.map((award) => award.achievementId));
  const liveProgress = buildAchievementProgress(stats);
  const locked = allAchievements
    .filter((achievement) => !awarded.has(achievement.id) && achievement.threshold)
    .map((achievement) => {
      const progress = liveProgress[achievement.name] ?? 0;
      const remaining = Math.max(0, (achievement.threshold ?? 0) - progress);
      return {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        icon: achievement.icon,
        threshold: achievement.threshold ?? 0,
        progress,
        remaining,
        percent: Math.min(100, Math.round((progress / Math.max(achievement.threshold ?? 1, 1)) * 100)),
      };
    })
    .sort((a, b) => a.remaining - b.remaining)[0];
  return locked ? { ...locked, nextAction: actionForAchievement(locked) } : null;
}

export async function updateCoachMemory(userId: string): Promise<CoachAgentReport> {
  const { sessions, reps, profile, recoveryCheckIn } = await loadAgentEvidence(userId);
  const closest = await closestAchievement(userId);
  const achievementRecommendation = closest ? `${closest.name}: ${closest.remaining} more to unlock. ${closest.nextAction}` : "All tracked achievements are currently unlocked or waiting for more data.";
  const decision = buildCoachDecision({ recentSessions: sessions, reps, achievementRecommendation });
  const failedMetrics = topValues(reps.flatMap((rep) => scorecardLabels(rep, "fail")));
  const strongMetrics = topValues(reps.flatMap((rep) => scorecardLabels(rep, "pass")));
  const guidedPlan = buildGuidedCoachPlan({ decision, sessions, failedMetrics, closestAchievement: closest });
  const readiness = buildReadinessReport({
    sessions,
    sleepHours: profile?.sleepHours,
    recoveryCheckIn,
    failedMetrics,
  });
  const strainLoad = buildStrainLoadReport(sessions);
  const weeklyAdaptivePlan = buildWeeklyAdaptivePlan({
    readiness,
    strainLoad,
    decision,
    focusMetric: guidedPlan.focusMetric,
    closestAchievement: closest,
  });
  const bodyBattery = buildBodyBattery({ readiness, strainLoad });
  const smartAlerts = buildSmartAlerts({ readiness, strainLoad, closestAchievement: closest, weeklyPlan: weeklyAdaptivePlan, sessions });
  const trendInsights = buildTrendInsights(sessions);
  const recurringIssues = topValues(
    sessions.flatMap((session) => {
      const parsed = parseJsonArray<any>(session.issueHistory, []);
      return parsed.map((item) => String(item?.message ?? "")).filter(Boolean);
    }),
  );
  const report = weeklyReport(sessions.filter((session) => Date.now() - session.date.getTime() <= 7 * 24 * 60 * 60 * 1000), decision);
  const memory = {
    weakMetrics: failedMetrics,
    strongMetrics,
    recurringIssues,
    recommendedFocus: failedMetrics[0] ?? recurringIssues[0] ?? decision.nextAction,
    preferredNextAction: decision.priority,
  };

  if (isDatabaseConfigured) {
    const existing = await db.query.coachMemories.findFirst({ where: eq(coachMemories.userId, userId) });
    const payload = {
      weakMetrics: toJson(memory.weakMetrics),
      strongMetrics: toJson(memory.strongMetrics),
      recurringIssues: toJson(memory.recurringIssues),
      recommendedFocus: memory.recommendedFocus,
      preferredNextAction: memory.preferredNextAction,
      lastDecision: toJson(decision),
      weeklySummary: toJson(report),
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(coachMemories).set(payload).where(eq(coachMemories.id, existing.id));
    } else {
      await db.insert(coachMemories).values({
        id: nanoid(),
        userId,
        ...payload,
        createdAt: new Date(),
      });
    }
  }

  return {
    memory,
    ...guidedPlan,
    closestAchievement: closest,
    preSessionBrief: {
      ...decision,
      nextAction: `Before starting: ${decision.nextAction}`,
    },
    postSessionNextAction: decision,
    weeklyReport: report,
    readiness,
    strainLoad,
    weeklyAdaptivePlan,
    bodyBattery,
    smartAlerts,
    trendInsights,
    wearableIntegrations: [
      { name: "Apple Health", status: "planned", signal: "sleep, steps, active energy" },
      { name: "Google Fit", status: "planned", signal: "activity minutes, calories, heart points" },
      { name: "Fitbit / WHOOP imports", status: "planned", signal: "recovery, HRV, resting heart rate" },
    ],
    achievementRecommendation,
  };
}

export async function getCoachAgentReport(userId: string) {
  return updateCoachMemory(userId);
}
