import { desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { coachMemories, exerciseReps, workoutSessions } from "@/db/schema";
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
  const sessions = await db.query.workoutSessions.findMany({
    where: eq(workoutSessions.userId, userId),
    orderBy: [desc(workoutSessions.date)],
    limit: 20,
  });
  const sessionIds = sessions.map((session) => session.id);
  const reps = sessionIds.length
    ? await db.query.exerciseReps.findMany({
        where: inArray(exerciseReps.sessionId, sessionIds),
      })
    : [];
  return { sessions, reps };
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
  const { sessions, reps } = await loadAgentEvidence(userId);
  const closest = await closestAchievement(userId);
  const achievementRecommendation = closest ? `${closest.name}: ${closest.remaining} more to unlock. ${closest.nextAction}` : "All tracked achievements are currently unlocked or waiting for more data.";
  const decision = buildCoachDecision({ recentSessions: sessions, reps, achievementRecommendation });
  const failedMetrics = topValues(reps.flatMap((rep) => scorecardLabels(rep, "fail")));
  const strongMetrics = topValues(reps.flatMap((rep) => scorecardLabels(rep, "pass")));
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

  return {
    memory,
    ...buildGuidedCoachPlan({ decision, sessions, failedMetrics, closestAchievement: closest }),
    closestAchievement: closest,
    preSessionBrief: {
      ...decision,
      nextAction: `Before starting: ${decision.nextAction}`,
    },
    postSessionNextAction: decision,
    weeklyReport: report,
    achievementRecommendation,
  };
}

export async function getCoachAgentReport(userId: string) {
  return updateCoachMemory(userId);
}
