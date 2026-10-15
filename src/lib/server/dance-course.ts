import { sql, and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, isDatabaseConfigured } from "@/db";
import { danceCourseAttempts, danceCourseProgress, users, workoutSessions } from "@/db/schema";
import { DEMO_COMMUNITY_LEADERBOARD } from "@/lib/demo-performance";
import type { CommunityAthlete } from "@/lib/demo-performance";
import type { DanceRoutinePack } from "@/lib/dance/types";
import { buildDanceCourseState, clampDanceScore, isDanceAttemptComplete, resolveDanceCourseStatus } from "@/lib/dance/course-rules";
export type { DanceCourseState, DanceCourseStatus } from "@/lib/dance/course-rules";

export type DanceCourseAttemptInput = {
  routineId: string;
  segmentId: string;
  mode?: "guided_practice" | "full_routine" | "manual";
  sourceSessionId?: string | null;
  score: number;
  reliability: number;
  timingScore?: number;
  transitionScore?: number;
  durationSeconds?: number;
  notes?: string | null;
};

export function buildDemoDanceCourseState(routine: DanceRoutinePack) {
  const now = new Date("2026-06-29T09:00:00.000Z");
  const progressRows = (routine.tutorial ?? []).slice(0, 4).map((step, index) => ({
    id: `demo-progress-${step.segmentId}`,
    userId: "demo-user-001",
    routineId: routine.id,
    segmentId: step.segmentId,
    status: index < 2 ? "completed" : "practicing",
    bestScore: [88, 84, 76, 72][index] ?? 0,
    bestReliability: [82, 79, 78, 74][index] ?? 0,
    attempts: [3, 2, 1, 1][index] ?? 0,
    completedAt: index < 2 ? now : null,
    lastAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  }));
  const attemptRows = progressRows.map((progress, index) => ({
    id: `demo-attempt-${progress.segmentId}`,
    userId: progress.userId,
    routineId: routine.id,
    segmentId: progress.segmentId,
    mode: index < 2 ? "full_routine" : "guided_practice",
    sourceSessionId: null,
    score: progress.bestScore ?? 0,
    reliability: progress.bestReliability ?? 0,
    timingScore: Math.max(0, (progress.bestScore ?? 0) - 4),
    transitionScore: Math.max(0, (progress.bestScore ?? 0) - 7),
    durationSeconds: 60,
    completed: progress.status === "completed",
    notes: "Demo course attempt",
    createdAt: now,
  }));
  return buildDanceCourseState({
    routine,
    progressRows,
    attemptRows,
    leaderboard: DEMO_COMMUNITY_LEADERBOARD,
  });
}

async function getDanceLeaderboard(): Promise<CommunityAthlete[]> {
  if (!isDatabaseConfigured) {
    return DEMO_COMMUNITY_LEADERBOARD;
  }

  const sessions = await db.query.workoutSessions.findMany({
    where: eq(workoutSessions.type, "dance"),
    orderBy: [desc(workoutSessions.date)],
    limit: 200,
  });
  if (!sessions.length) return DEMO_COMMUNITY_LEADERBOARD;

  const userIds = Array.from(new Set(sessions.map((session) => session.userId)));
  const userRows = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
  const userById = new Map(userRows.map((user) => [user.id, user]));
  const grouped = new Map<string, typeof sessions>();
  sessions.forEach((session) => {
    grouped.set(session.userId, [...(grouped.get(session.userId) ?? []), session]);
  });

  return Array.from(grouped.entries())
    .map(([userId, userSessions]) => {
      const sorted = [...userSessions].sort((a, b) => b.date.getTime() - a.date.getTime());
      const score = Math.round(sorted.reduce((sum, session) => sum + (session.compositeScore ?? 0), 0) / Math.max(sorted.length, 1));
      const lastScore = sorted[0]?.compositeScore ?? score;
      const previousScore = sorted[1]?.compositeScore ?? lastScore;
      const user = userById.get(userId);
      const name = user?.name?.split(" ")[0] || "Athlete";
      return {
        id: userId,
        name,
        role: sorted.length >= 10 ? "Dance regular" : "Course learner",
        level: score >= 90 ? "Gold" : score >= 82 ? "Silver" : "Bronze",
        avatar: name.slice(0, 2).toUpperCase(),
        score,
        streak: Math.min(sorted.length, 14),
        sessions: sorted.length,
        danceScore: score,
        topMove: "Hip-Hop Starter Groove",
        trend: lastScore >= previousScore ? "up" : "steady",
      } satisfies CommunityAthlete;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export async function getDanceCourseState(userId: string, routine: DanceRoutinePack, options: { demo?: boolean } = {}) {
  if (options.demo || !isDatabaseConfigured) return buildDemoDanceCourseState(routine);

  const [progressRows, attemptRows, leaderboard] = await Promise.all([
    db.query.danceCourseProgress.findMany({
      where: and(eq(danceCourseProgress.userId, userId), eq(danceCourseProgress.routineId, routine.id)),
      orderBy: [desc(danceCourseProgress.updatedAt)],
    }),
    db.query.danceCourseAttempts.findMany({
      where: and(eq(danceCourseAttempts.userId, userId), eq(danceCourseAttempts.routineId, routine.id)),
      orderBy: [desc(danceCourseAttempts.createdAt)],
      limit: 12,
    }),
    getDanceLeaderboard(),
  ]);

  return buildDanceCourseState({ routine, progressRows, attemptRows, leaderboard });
}

export async function recordDanceCourseAttempt(userId: string, input: DanceCourseAttemptInput, database: Pick<typeof db, "query" | "insert" | "update" | "execute"> = db): Promise<{ completed: boolean; status: string; bestScore: number; bestReliability: number; attempts: number }> {
  if (isDatabaseConfigured && database === db) return db.transaction(tx => recordDanceCourseAttempt(userId, input, tx));
  const now = new Date();
  const score = clampDanceScore(input.score);
  const reliability = clampDanceScore(input.reliability);
  const completed = isDanceAttemptComplete(score, reliability);

  if (!isDatabaseConfigured) {
    const attempts = 1;
    const status = resolveDanceCourseStatus({ score, reliability, attempts });
    return {
      completed,
      status,
      bestScore: score,
      bestReliability: reliability,
      attempts,
    };
  }

  await database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId + ":" + input.routineId + ":" + input.segmentId}, 0))`);
  const existing = await database.query.danceCourseProgress.findFirst({
    where: and(
      eq(danceCourseProgress.userId, userId),
      eq(danceCourseProgress.routineId, input.routineId),
      eq(danceCourseProgress.segmentId, input.segmentId),
    ),
  });

  await database.insert(danceCourseAttempts).values({
    id: nanoid(),
    userId,
    routineId: input.routineId,
    segmentId: input.segmentId,
    mode: input.mode ?? "full_routine",
    sourceSessionId: input.sourceSessionId ?? null,
    score,
    reliability,
    timingScore: clampDanceScore(input.timingScore),
    transitionScore: clampDanceScore(input.transitionScore),
    durationSeconds: Math.max(0, Math.round(input.durationSeconds ?? 0)),
    completed,
    notes: input.notes ?? null,
    createdAt: now,
  });

  const nextBestScore = Math.max(existing?.bestScore ?? 0, score);
  const nextBestReliability = Math.max(existing?.bestReliability ?? 0, reliability);
  const nextAttempts = (existing?.attempts ?? 0) + 1;
  const nextStatus = resolveDanceCourseStatus({ score: nextBestScore, reliability: nextBestReliability, attempts: nextAttempts });
  const completedAt = existing?.completedAt ?? (nextStatus === "completed" ? now : null);

  if (existing) {
    await database
      .update(danceCourseProgress)
      .set({
        bestScore: nextBestScore,
        bestReliability: nextBestReliability,
        attempts: nextAttempts,
        status: nextStatus,
        completedAt,
        lastAttemptAt: now,
        updatedAt: now,
      })
      .where(eq(danceCourseProgress.id, existing.id));
  } else {
    await database.insert(danceCourseProgress).values({
      id: nanoid(),
      userId,
      routineId: input.routineId,
      segmentId: input.segmentId,
      status: nextStatus,
      bestScore: nextBestScore,
      bestReliability: nextBestReliability,
      attempts: nextAttempts,
      completedAt,
      lastAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    completed,
    status: nextStatus,
    bestScore: nextBestScore,
    bestReliability: nextBestReliability,
    attempts: nextAttempts,
  };
}
