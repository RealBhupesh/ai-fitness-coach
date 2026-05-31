import { desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { coachMemories, exerciseReps, workoutSessions } from "@/db/schema";
import { ensureAchievements } from "@/lib/server/app-data";
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
  preSessionBrief: CoachDecision;
  postSessionNextAction: CoachDecision;
  weeklyReport: {
    summary: string;
    evidence: string[];
    planAdjustment: string;
  };
  achievementRecommendation: string;
};

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

async function closestAchievement(userId: string) {
  const { allAchievements, awards } = await ensureAchievements(userId);
  const awarded = new Set(awards.map((award) => award.achievementId));
  const locked = allAchievements
    .filter((achievement) => !awarded.has(achievement.id) && achievement.threshold)
    .map((achievement) => {
      const award = awards.find((item) => item.achievementId === achievement.id);
      return {
        name: achievement.name,
        remaining: Math.max(0, (achievement.threshold ?? 0) - (award?.progress ?? 0)),
      };
    })
    .sort((a, b) => a.remaining - b.remaining)[0];
  return locked ? `${locked.name}: ${locked.remaining} more to unlock.` : "All tracked achievements are currently unlocked or waiting for more data.";
}

export async function updateCoachMemory(userId: string): Promise<CoachAgentReport> {
  const { sessions, reps } = await loadAgentEvidence(userId);
  const achievementRecommendation = await closestAchievement(userId);
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
