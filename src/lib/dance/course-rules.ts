import { DEMO_ACHIEVEMENTS } from "@/lib/demo-performance";
import type { CommunityAthlete } from "@/lib/demo-performance";
import type { DanceRoutinePack, DanceTutorialStep } from "@/lib/dance/types";

export const DANCE_PASS_SCORE = 80;
export const DANCE_PASS_RELIABILITY = 70;

export type DanceCourseStatus = "not_started" | "practicing" | "completed";

export type DanceProgressLike = {
  segmentId: string;
  status?: string | null;
  bestScore?: number | null;
  bestReliability?: number | null;
  attempts?: number | null;
  completedAt?: Date | null;
  lastAttemptAt?: Date | null;
};

export type DanceAttemptLike = {
  id: string;
  segmentId: string;
  mode: string;
  score: number;
  reliability: number;
  timingScore?: number | null;
  transitionScore?: number | null;
  completed?: boolean | null;
  createdAt: Date;
};

export type DanceCourseLessonProgress = {
  segmentId: string;
  title: string;
  count: string;
  status: DanceCourseStatus;
  bestScore: number;
  bestReliability: number;
  attempts: number;
  completedAt: string | null;
  lastAttemptAt: string | null;
};

export type DanceCourseState = {
  routineId: string;
  passScore: number;
  passReliability: number;
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
  nextLesson: DanceCourseLessonProgress | null;
  lessons: DanceCourseLessonProgress[];
  recentAttempts: Array<{
    id: string;
    segmentId: string;
    mode: string;
    score: number;
    reliability: number;
    timingScore: number;
    transitionScore: number;
    completed: boolean;
    createdAt: string;
  }>;
  leaderboard: CommunityAthlete[];
  featuredAchievements: typeof DEMO_ACHIEVEMENTS;
};

export function clampDanceScore(value: number | null | undefined) {
  return Math.max(0, Math.min(100, Math.round(Number(value ?? 0))));
}

export function isDanceAttemptComplete(score: number, reliability: number) {
  return clampDanceScore(score) >= DANCE_PASS_SCORE && clampDanceScore(reliability) >= DANCE_PASS_RELIABILITY;
}

export function resolveDanceCourseStatus(options: {
  score: number;
  reliability: number;
  attempts: number;
}): DanceCourseStatus {
  if (isDanceAttemptComplete(options.score, options.reliability)) return "completed";
  if (options.attempts > 0) return "practicing";
  return "not_started";
}

function lessonFromStep(step: DanceTutorialStep, progress?: DanceProgressLike | null): DanceCourseLessonProgress {
  const bestScore = clampDanceScore(progress?.bestScore);
  const bestReliability = clampDanceScore(progress?.bestReliability);
  const attempts = progress?.attempts ?? 0;
  const status = (progress?.status as DanceCourseStatus | null) ?? resolveDanceCourseStatus({ score: bestScore, reliability: bestReliability, attempts });
  return {
    segmentId: step.segmentId,
    title: step.title,
    count: step.count,
    status,
    bestScore,
    bestReliability,
    attempts,
    completedAt: progress?.completedAt?.toISOString() ?? null,
    lastAttemptAt: progress?.lastAttemptAt?.toISOString() ?? null,
  };
}

export function buildDanceCourseState({
  routine,
  progressRows,
  attemptRows,
  leaderboard,
}: {
  routine: DanceRoutinePack;
  progressRows: DanceProgressLike[];
  attemptRows: DanceAttemptLike[];
  leaderboard: CommunityAthlete[];
}): DanceCourseState {
  const progressBySegment = new Map(progressRows.map((progress) => [progress.segmentId, progress]));
  const steps = routine.tutorial?.length
    ? routine.tutorial
    : routine.segments.map((segment, index) => ({
        id: `${segment.id}-tutorial`,
        segmentId: segment.id,
        order: index + 1,
        title: segment.label,
        count: `${index + 1}`,
        teachingCue: segment.cue,
        practiceCue: segment.focus,
        commonMistake: "Phrase needs more measured evidence.",
        correction: "Run one guided practice attempt.",
      }));
  const lessons = steps.map((step) => lessonFromStep(step, progressBySegment.get(step.segmentId)));
  const completedLessons = lessons.filter((lesson) => lesson.status === "completed").length;
  const totalLessons = Math.max(lessons.length, 1);
  const nextLesson = lessons.find((lesson) => lesson.status !== "completed") ?? lessons[lessons.length - 1] ?? null;

  return {
    routineId: routine.id,
    passScore: DANCE_PASS_SCORE,
    passReliability: DANCE_PASS_RELIABILITY,
    completionPercent: Math.round((completedLessons / totalLessons) * 100),
    completedLessons,
    totalLessons: lessons.length,
    nextLesson,
    lessons,
    recentAttempts: attemptRows.map((attempt) => ({
      id: attempt.id,
      segmentId: attempt.segmentId,
      mode: attempt.mode,
      score: attempt.score,
      reliability: attempt.reliability,
      timingScore: attempt.timingScore ?? 0,
      transitionScore: attempt.transitionScore ?? 0,
      completed: Boolean(attempt.completed),
      createdAt: attempt.createdAt.toISOString(),
    })),
    leaderboard,
    featuredAchievements: DEMO_ACHIEVEMENTS,
  };
}
