import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AppUserProfile, DashboardSummary, Goal, ProfilePersona } from "@/lib/app-types";
import { db, isDatabaseConfigured } from "@/db";
import { DEMO_ACHIEVEMENT_STATS, DEMO_DASHBOARD_SUMMARY } from "@/lib/demo-performance";
import { isDemoUser } from "@/lib/dummy-auth";
import {
  achievements,
  chatSessions,
  danceRoutines,
  exerciseReps,
  foodLog,
  nutritionPlans,
  progressTracking,
  userAchievements,
  userProfiles,
  users,
  workoutPlans,
  workoutSessions,
} from "@/db/schema";
import { parseJsonArray, parseJsonObject, toJson } from "@/lib/utils/json";

type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  threshold: number;
  points: number;
};

declare global {
  var __fitcoachFallbackProfiles: Map<string, AppUserProfile> | undefined;
}

export type AchievementStats = {
  totalSessions: number;
  totalCalories: number;
  totalReps: number;
  danceSessionsCount: number;
  strengthSessionsCount: number;
  bestCompositeScore: number;
  highScoreSessions: number;
  curlScorecards: number;
  squatScorecards: number;
  danceScoreSessions: number;
  currentStreak: number;
  weeklySessionPeak: number;
};

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: "ach_first_steps", name: "First Steps", description: "Complete your first fitness or dance session", category: "milestone", icon: "👟", threshold: 1, points: 10 },
  { id: "ach_week_warrior", name: "Week Warrior", description: "Build a 7-day training streak", category: "consistency", icon: "🔥", threshold: 7, points: 50 },
  { id: "ach_month_master", name: "Month Master", description: "Build a 30-day training streak", category: "consistency", icon: "💪", threshold: 30, points: 200 },
  { id: "ach_century_club", name: "Century Club", description: "Complete 100 total sessions", category: "workout", icon: "🎯", threshold: 100, points: 500 },
  { id: "ach_calorie_crusher", name: "Calorie Crusher", description: "Burn 10,000 total calories across saved sessions", category: "calories", icon: "🔥", threshold: 10000, points: 300 },
  { id: "ach_dance_master", name: "Dance Master", description: "Complete 50 dance sessions", category: "dance", icon: "💃", threshold: 50, points: 250 },
  { id: "ach_strength_legend", name: "Strength Legend", description: "Complete 100 strength training sessions", category: "fitness", icon: "🏋️", threshold: 100, points: 400 },
  { id: "ach_perfect_week", name: "Perfect Week", description: "Complete 7 sessions in one calendar week", category: "consistency", icon: "⭐", threshold: 7, points: 100 },
  { id: "ach_transformation", name: "Transformation", description: "Complete 90 total training days", category: "milestone", icon: "🦋", threshold: 90, points: 1000 },
  { id: "ach_rep_collector", name: "Rep Collector", description: "Log 250 counted reps from live coaching", category: "fitness", icon: "🔢", threshold: 250, points: 120 },
  { id: "ach_form_scholar", name: "Form Scholar", description: "Finish 10 sessions with a score of 85 or higher", category: "fitness", icon: "📈", threshold: 10, points: 150 },
  { id: "ach_curl_technician", name: "Curl Technician", description: "Save 25 bicep curl reps with scorecard evidence", category: "fitness", icon: "💪", threshold: 25, points: 120 },
  { id: "ach_squat_foundation", name: "Squat Foundation", description: "Save 25 squat reps with scorecard evidence", category: "fitness", icon: "🦵", threshold: 25, points: 120 },
  { id: "ach_hip_hop_debut", name: "Hip-Hop Debut", description: "Complete your first hip-hop dance session", category: "dance", icon: "🎧", threshold: 1, points: 30 },
  { id: "ach_groove_builder", name: "Groove Builder", description: "Complete 10 dance sessions with saved timing and phrase evidence", category: "dance", icon: "🕺", threshold: 10, points: 120 },
];

export function mapProfileToApp(user: { id: string; email: string; name: string } | null, profile: typeof userProfiles.$inferSelect | null): AppUserProfile | null {
  if (!user) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    age: profile?.age ?? undefined,
    gender: (profile?.gender as AppUserProfile["gender"]) ?? undefined,
    heightCm: profile?.height ?? undefined,
    weightKg: profile?.weight ?? undefined,
    targetWeightKg: profile?.targetWeight ?? undefined,
    experience: (profile?.fitnessLevel as AppUserProfile["experience"]) ?? "beginner",
    goals: parseJsonArray<Goal>(profile?.goals, []),
    profileType: (profile?.profileType as AppUserProfile["profileType"]) ?? undefined,
    primarySport: profile?.primarySport ?? undefined,
    trainingStyle: profile?.trainingStyle ?? undefined,
    readinessAssumptions: parseJsonArray<string>(profile?.readinessAssumptions, []),
    coachingConstraints: parseJsonArray<string>(profile?.coachingConstraints, []),
    baselineMetrics: parseJsonObject<AppUserProfile["baselineMetrics"]>(profile?.baselineMetrics, undefined),
    dietaryPrefs: parseJsonArray<AppUserProfile["dietaryPrefs"][number]>(profile?.dietaryPreferences, []),
    injuries: parseJsonArray<string>(profile?.injuries, []),
    painPoints: parseJsonArray<string>(profile?.painPoints, []),
    equipmentAccess: parseJsonArray<string>(profile?.equipmentAccess, []),
    allergies: parseJsonArray<string>(profile?.allergies, []).join(", ") || undefined,
    workoutFrequency: profile?.workoutFrequency ?? undefined,
    workoutDuration: profile?.workoutDuration ?? undefined,
    cuisinePreference: profile?.cuisinePreference ?? undefined,
    budgetTier: (profile?.budgetTier as AppUserProfile["budgetTier"]) ?? undefined,
    coachingTone: (profile?.coachingTone as AppUserProfile["coachingTone"]) ?? undefined,
    sleepHours: profile?.sleepHours ?? undefined,
    onboardingCompleted: Boolean(profile?.onboardingCompleted),
    lastUpdated: profile?.updatedAt?.toISOString?.(),
  };
}

function fallbackProfiles() {
  if (!globalThis.__fitcoachFallbackProfiles) {
    globalThis.__fitcoachFallbackProfiles = new Map();
  }
  return globalThis.__fitcoachFallbackProfiles;
}

function buildFallbackProfile(userId: string, profile: Partial<AppUserProfile> = {}): AppUserProfile {
  return {
    userId,
    email: profile.email ?? "demo@fitcoach.local",
    name: profile.name?.trim() || (isDemoUser(userId) ? "Demo User" : "FitCoach User"),
    age: profile.age,
    gender: profile.gender,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    targetWeightKg: profile.targetWeightKg,
    experience: profile.experience ?? "beginner",
    goals: profile.goals?.length ? profile.goals : ["dance_skill", "general_fitness"],
    profileType: profile.profileType ?? "dance_athlete",
    primarySport: profile.primarySport ?? "Hip-hop dance",
    trainingStyle: profile.trainingStyle ?? "Camera-guided demo coaching",
    readinessAssumptions: profile.readinessAssumptions ?? ["Demo data is used because no database is configured"],
    coachingConstraints: profile.coachingConstraints ?? ["Keep feedback practical, evidence-based, and non-medical"],
    baselineMetrics: profile.baselineMetrics ?? { readinessScore: 72, mobilityScore: 76, danceTimingScore: 64, postureConfidence: 78 },
    dietaryPrefs: profile.dietaryPrefs ?? [],
    injuries: profile.injuries ?? [],
    painPoints: profile.painPoints ?? [],
    equipmentAccess: profile.equipmentAccess ?? ["Laptop webcam", "Open floor"],
    allergies: profile.allergies,
    workoutFrequency: profile.workoutFrequency ?? 4,
    workoutDuration: profile.workoutDuration ?? 25,
    cuisinePreference: profile.cuisinePreference,
    budgetTier: profile.budgetTier,
    coachingTone: profile.coachingTone ?? "motivational",
    sleepHours: profile.sleepHours,
    onboardingCompleted: profile.onboardingCompleted ?? true,
    lastUpdated: profile.lastUpdated ?? new Date().toISOString(),
  };
}

export async function getAppProfile(userId: string) {
  if (!isDatabaseConfigured) {
    const profile = fallbackProfiles().get(userId) ?? buildFallbackProfile(userId);
    fallbackProfiles().set(userId, profile);
    return profile;
  }

  const [user, profile] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) }),
  ]);
  if (!user) return null;
  return mapProfileToApp(user, profile ?? null);
}

export function toProfileDbInput(profile: Partial<AppUserProfile>) {
  return {
    age: profile.age,
    gender: profile.gender,
    height: profile.heightCm,
    weight: profile.weightKg,
    targetWeight: profile.targetWeightKg,
    fitnessLevel: profile.experience,
    goals: profile.goals ? toJson(profile.goals) : undefined,
    profileType: profile.profileType,
    primarySport: profile.primarySport,
    trainingStyle: profile.trainingStyle,
    readinessAssumptions: profile.readinessAssumptions ? toJson(profile.readinessAssumptions) : undefined,
    coachingConstraints: profile.coachingConstraints ? toJson(profile.coachingConstraints) : undefined,
    baselineMetrics: profile.baselineMetrics ? toJson(profile.baselineMetrics) : undefined,
    dietaryPreferences: profile.dietaryPrefs ? toJson(profile.dietaryPrefs) : undefined,
    injuries: profile.injuries ? toJson(profile.injuries) : undefined,
    painPoints: profile.painPoints ? toJson(profile.painPoints) : undefined,
    equipmentAccess: profile.equipmentAccess ? toJson(profile.equipmentAccess) : undefined,
    allergies: profile.allergies ? toJson(profile.allergies.split(",").map((item) => item.trim()).filter(Boolean)) : undefined,
    workoutFrequency: profile.workoutFrequency,
    workoutDuration: profile.workoutDuration,
    cuisinePreference: profile.cuisinePreference,
    budgetTier: profile.budgetTier,
    coachingTone: profile.coachingTone,
    sleepHours: profile.sleepHours,
    onboardingCompleted: profile.onboardingCompleted,
  };
}

export function saveFallbackAppProfile(userId: string, profile: Partial<AppUserProfile>) {
  const current = fallbackProfiles().get(userId) ?? buildFallbackProfile(userId);
  const next = buildFallbackProfile(userId, {
    ...current,
    ...profile,
    lastUpdated: new Date().toISOString(),
  });
  fallbackProfiles().set(userId, next);
  return next;
}

export function clearFallbackAppProfile(userId: string) {
  fallbackProfiles().delete(userId);
  return buildFallbackProfile(userId);
}

export const PROFILE_PERSONAS: ProfilePersona[] = [
  {
    id: "persona-baseline-beginner",
    title: "Beginner Rebuild",
    profileType: "beginner_rebuild",
    name: "Aarav Baseline",
    summary: "New lifter rebuilding consistency with short sessions, conservative load, and high camera-guided form feedback.",
    goals: ["general_fitness", "mobility"],
    assumptions: ["Three training days per week", "Low equipment access", "Needs confidence-building cues before intensity"],
    coachingPlan: ["Start with 20 minute full-body sessions", "Prioritize squat depth, plank line, and shoulder control", "Progress only after two clean sessions above 80 form score"],
    riskFlags: ["Avoid medical diagnosis", "Pause on sharp pain reports", "Use low-impact alternatives when fatigue rises"],
    sampleProfile: {
      userId: "sample-beginner",
      name: "Aarav Baseline",
      experience: "beginner",
      goals: ["general_fitness", "mobility"],
      profileType: "beginner_rebuild",
      primarySport: "General fitness",
      trainingStyle: "Short coached fundamentals",
      readinessAssumptions: ["Likely inconsistent routine", "Needs simple cues", "Recovery score estimated until enough sessions exist"],
      coachingConstraints: ["No medical claims", "No advanced plyometrics in first week"],
      baselineMetrics: { readinessScore: 66, mobilityScore: 58, strengthScore: 46, postureConfidence: 72 },
      dietaryPrefs: ["omnivore"],
      injuries: [],
      painPoints: ["Lower back tightness"],
      equipmentAccess: ["Mat", "Chair"],
      workoutFrequency: 3,
      workoutDuration: 20,
      coachingTone: "friendly",
      onboardingCompleted: true,
    },
  },
  {
    id: "persona-strength",
    title: "Strength Focused",
    profileType: "strength_focused",
    name: "Maya Strength",
    summary: "Intermediate athlete using strict scoring to improve squat, curl, and weekly load consistency.",
    goals: ["muscle_gain", "general_fitness"],
    assumptions: ["Four sessions per week", "Has dumbbells", "Wants direct trainer-style correction"],
    coachingPlan: ["Track form trend per exercise", "Use stricter tempo targets", "Recommend recovery when weekly load spikes"],
    riskFlags: ["Watch knee valgus trend", "Flag low landmark confidence before form claims"],
    sampleProfile: {
      userId: "sample-strength",
      name: "Maya Strength",
      experience: "intermediate",
      goals: ["muscle_gain", "general_fitness"],
      profileType: "strength_focused",
      primarySport: "Strength training",
      trainingStyle: "Strict progressive overload",
      readinessAssumptions: ["Good adherence", "Moderate fatigue tolerance", "Needs measurable rep-by-rep evidence"],
      coachingConstraints: ["Keep feedback strict but non-medical", "Do not increase load after failed safety score"],
      baselineMetrics: { readinessScore: 78, mobilityScore: 70, strengthScore: 74, postureConfidence: 84 },
      dietaryPrefs: ["vegetarian"],
      injuries: [],
      painPoints: ["Knee cave during fatigue"],
      equipmentAccess: ["Dumbbells", "Resistance bands", "Bench"],
      workoutFrequency: 4,
      workoutDuration: 45,
      coachingTone: "strict",
      onboardingCompleted: true,
    },
  },
  {
    id: "persona-dance",
    title: "Dance Athlete",
    profileType: "dance_athlete",
    name: "Riya Groove",
    summary: "Hip-hop learner combining tutorial skeleton follow-along, rhythm scoring, posture correction, and confidence tracking.",
    goals: ["dance_skill", "endurance"],
    assumptions: ["Laptop webcam at chest height", "Music timing matters as much as posture", "Learner needs phrase-level feedback"],
    coachingPlan: ["Compare against tutorial skeleton checkpoints", "Score timing, groove, arm lines, and lower-body bounce", "Use short loops before full routine attempts"],
    riskFlags: ["Avoid high-impact cues when landing control drops", "Camera confidence gates override scoring"],
    sampleProfile: {
      userId: "sample-dance",
      name: "Riya Groove",
      experience: "beginner",
      goals: ["dance_skill", "endurance"],
      profileType: "dance_athlete",
      primarySport: "Hip-hop dance",
      trainingStyle: "Tutorial skeleton follow-along",
      readinessAssumptions: ["Needs visual imitation", "Timing improves with repeated phrase loops", "Upper-body angles may be noisy on small webcams"],
      coachingConstraints: ["Keep feedback actionable in one cue", "Do not judge style when skeleton confidence is low"],
      baselineMetrics: { readinessScore: 72, mobilityScore: 76, danceTimingScore: 52, postureConfidence: 68 },
      dietaryPrefs: ["omnivore"],
      injuries: [],
      painPoints: [],
      equipmentAccess: ["Laptop webcam", "Open floor"],
      workoutFrequency: 5,
      workoutDuration: 25,
      coachingTone: "motivational",
      onboardingCompleted: true,
    },
  },
];

export function getProfilePersonas(currentProfile: AppUserProfile | null) {
  return {
    currentProfile,
    personas: PROFILE_PERSONAS,
    assumptions: [
      "Sample profiles are product assumptions used for demos, QA, and coach calibration.",
      "Real users should complete onboarding before personalization is treated as reliable.",
      "AI coach guidance is not medical diagnosis and should be constrained by measured evidence.",
    ],
  };
}

export async function ensureChatSession(userId: string) {
  if (!isDatabaseConfigured) {
    const now = new Date();
    return {
      id: `fallback-chat-${userId}`,
      userId,
      title: "FitCoach AI",
      summary: null,
      context: null,
      createdAt: now,
      lastMessageAt: now,
    };
  }

  const existing = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.userId, userId),
    orderBy: [desc(chatSessions.lastMessageAt), desc(chatSessions.createdAt)],
  });
  if (existing) return existing;
  const session = {
    id: nanoid(),
    userId,
    title: "FitCoach AI",
    summary: null,
    context: null,
    createdAt: new Date(),
    lastMessageAt: new Date(),
  };
  await db.insert(chatSessions).values(session);
  return session;
}

function normalizeDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function calculateStreak(sessionDates: Date[]) {
  const days = new Set(sessionDates.map((date) => normalizeDate(date)));
  let streak = 0;
  const cursor = new Date();
  while (days.has(normalizeDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calculateWeeklySessionPeak(sessionDates: Date[]) {
  const counts = new Map<string, number>();
  sessionDates.forEach((date) => {
    const copy = new Date(date);
    const day = copy.getDay();
    copy.setDate(copy.getDate() - day);
    const key = normalizeDate(copy);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Math.max(0, ...counts.values());
}

function safeParseObject(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function countScorecardReps(reps: Array<{ curlScorecard?: string | null; squatScorecard?: string | null }>) {
  return reps.reduce(
    (acc, rep) => {
      if (safeParseObject(rep.curlScorecard ?? null)) acc.curl += 1;
      if (safeParseObject(rep.squatScorecard ?? null)) acc.squat += 1;
      return acc;
    },
    { curl: 0, squat: 0 },
  );
}

function countDanceEvidenceSessions(sessions: Array<{ type: string; telemetry?: string | null; postSetAnalysis?: string | null }>) {
  return sessions.filter((session) => {
    if (session.type !== "dance") return false;
    const telemetry = safeParseObject(session.telemetry ?? null);
    const postSet = safeParseObject(session.postSetAnalysis ?? null);
    return Boolean(telemetry || postSet);
  }).length;
}

export function buildAchievementProgress(stats: AchievementStats) {
  const progress: Record<string, number> = {
    "First Steps": stats.totalSessions,
    "Week Warrior": stats.currentStreak,
    "Month Master": stats.currentStreak,
    "Century Club": stats.totalSessions,
    "Calorie Crusher": stats.totalCalories,
    "Dance Master": stats.danceSessionsCount,
    "Strength Legend": stats.strengthSessionsCount,
    "Perfect Week": stats.weeklySessionPeak,
    Transformation: Math.min(90, stats.totalSessions),
    "Rep Collector": stats.totalReps,
    "Form Scholar": stats.highScoreSessions,
    "Curl Technician": stats.curlScorecards,
    "Squat Foundation": stats.squatScorecards,
    "Hip-Hop Debut": stats.danceSessionsCount,
    "Groove Builder": stats.danceScoreSessions,
  };
  return progress;
}

async function ensureAchievementCatalog() {
  if (!isDatabaseConfigured) {
    return ACHIEVEMENT_DEFINITIONS.map((achievement) => ({
      ...achievement,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
  }

  const existing = await db.query.achievements.findMany();
  const existingNames = new Set(existing.map((achievement) => achievement.name));
  const missing = ACHIEVEMENT_DEFINITIONS.filter((achievement) => !existingNames.has(achievement.name));
  if (missing.length) {
    await db.insert(achievements).values(missing).onConflictDoNothing();
  }
  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    const current = existing.find((achievement) => achievement.name === definition.name);
    if (!current) continue;
    if (
      current.description !== definition.description ||
      current.category !== definition.category ||
      current.icon !== definition.icon ||
      current.threshold !== definition.threshold ||
      current.points !== definition.points
    ) {
      await db
        .update(achievements)
        .set({
          description: definition.description,
          category: definition.category,
          icon: definition.icon,
          threshold: definition.threshold,
          points: definition.points,
        })
        .where(eq(achievements.id, current.id));
    }
  }
  return db.query.achievements.findMany({ orderBy: [desc(achievements.points)] });
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  if (!isDatabaseConfigured) {
    return DEMO_DASHBOARD_SUMMARY;
  }

  const [sessions, progress, plans, plansHistory, nutrition] = await Promise.all([
    db.query.workoutSessions.findMany({
      where: eq(workoutSessions.userId, userId),
      orderBy: [desc(workoutSessions.date)],
      limit: 20,
    }),
    db.query.progressTracking.findMany({
      where: eq(progressTracking.userId, userId),
      orderBy: [desc(progressTracking.date)],
      limit: 16,
    }),
    db.query.workoutPlans.findFirst({
      where: and(eq(workoutPlans.userId, userId), eq(workoutPlans.isActive, true)),
      orderBy: [desc(workoutPlans.createdAt)],
    }),
    db.query.workoutPlans.findMany({
      where: eq(workoutPlans.userId, userId),
      orderBy: [desc(workoutPlans.createdAt)],
    }),
    db.query.nutritionPlans.findFirst({
      where: and(eq(nutritionPlans.userId, userId), eq(nutritionPlans.isActive, true)),
      orderBy: [desc(nutritionPlans.createdAt)],
    }),
  ]);

  const totalWorkouts = sessions.length;
  const totalMinutes = sessions.reduce((sum, item) => sum + (item.duration ?? 0), 0);
  const totalCalories = sessions.reduce((sum, item) => sum + (item.caloriesBurned ?? 0), 0);
  const averageScore =
    totalWorkouts > 0
      ? Math.round(
          sessions.reduce((sum, item) => sum + (item.compositeScore ?? item.rating ?? 0), 0) / totalWorkouts,
        )
      : 0;
  const streak = calculateStreak(sessions.map((item) => item.date));
  const adherence = plansHistory.length
    ? Math.min(
        100,
        Math.round((sessions.length / Math.max(plansHistory.reduce((sum, plan) => sum + (plan.daysPerWeek ?? 0), 0), 1)) * 100),
      )
    : Math.min(100, sessions.length * 10);

  return {
    streak,
    totalWorkouts,
    totalMinutes,
    totalCalories,
    averageScore,
    adherence,
    recentSessions: sessions.slice(0, 6).map((session) => ({
      id: session.id,
      type: session.type,
      exerciseType: session.exerciseType,
      date: session.date.toISOString(),
      duration: session.duration ?? 0,
      caloriesBurned: session.caloriesBurned ?? 0,
      compositeScore: session.compositeScore ?? 0,
      summary: session.summary,
    })),
    weightTrend: progress
      .filter((item) => item.weight != null)
      .reverse()
      .map((item) => ({
        date: item.date.toISOString(),
        weight: item.weight ?? 0,
      })),
    activePlan: plans
      ? {
          id: plans.id,
          name: plans.name,
          progress: Math.min(100, Math.round((sessions.length / Math.max(plans.duration * plans.daysPerWeek, 1)) * 100)),
          currentWeek: Math.min(plans.duration, Math.max(1, Math.ceil(Math.max(sessions.length, 1) / Math.max(plans.daysPerWeek, 1)))),
          daysPerWeek: plans.daysPerWeek,
        }
      : null,
    activeNutritionPlan: nutrition
      ? {
          id: nutrition.id,
          name: nutrition.name,
          dailyCalories: nutrition.dailyCalories,
          proteinGrams: nutrition.proteinGrams,
          carbsGrams: nutrition.carbsGrams,
          fatGrams: nutrition.fatGrams,
        }
      : null,
  };
}

export function buildFallbackWorkoutPlan(profile: AppUserProfile | null) {
  const goal = profile?.goals[0] ?? "general_fitness";
  const daysPerWeek = profile?.workoutFrequency ?? 4;
  const duration = 8;
  const difficulty = profile?.experience ?? "beginner";
  const weeklySchedule = Array.from({ length: daysPerWeek }, (_, index) => ({
    day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index],
    focus:
      goal === "muscle_gain"
        ? ["Upper body", "Lower body", "Push", "Pull", "Full body"][index % 5]
        : goal === "fat_loss"
          ? ["Conditioning", "Strength", "Intervals", "Mobility", "Circuit"][index % 5]
          : ["Movement quality", "Strength", "Cardio", "Recovery", "Full body"][index % 5],
    exercises: [
      { exerciseName: "Squats", sets: 3, reps: difficulty === "advanced" ? 15 : 10, restSeconds: 60 },
      { exerciseName: "Push-ups", sets: 3, reps: difficulty === "advanced" ? 15 : 8, restSeconds: 60 },
      { exerciseName: "Lunges", sets: 3, reps: 10, restSeconds: 45 },
    ],
    warmUp: ["March in place", "Arm circles", "Hip openers"],
    coolDown: ["Walk for 2 minutes", "Hamstring stretch", "Breathing reset"],
  }));

  return {
    name: `${goal.replace(/_/g, " ")} focus plan`,
    description: `A ${duration}-week training block tailored for ${profile?.name ?? "your goals"}.`,
    goal,
    duration,
    daysPerWeek,
    difficulty,
    weeklySchedule,
    progressionRules: ["Increase reps by 1-2 each week if the last set feels controlled."],
    regressionRules: ["Reduce reps by 20% and increase rest if pain or form breakdown appears."],
  };
}

export function buildFallbackNutritionPlan(profile: AppUserProfile | null) {
  const weight = profile?.weightKg ?? 70;
  const dailyCalories = Math.max(1400,Math.min(4200,
    profile?.goals[0] === "muscle_gain" ? Math.round(weight * 33) : profile?.goals[0] === "fat_loss" ? Math.round(weight * 27) : Math.round(weight * 30)));
  const proteinGrams = Math.min(320,Math.round(weight * 1.8));
  const fatGrams = Math.round((dailyCalories * 0.25) / 9);
  const carbsGrams = Math.round((dailyCalories - proteinGrams * 4 - fatGrams * 9) / 4);
  return {
    dailyCalories,
    macros: { proteinGrams, carbsGrams, fatGrams },
    meals: [
      {
        type: "breakfast",
        name: "Protein oats bowl",
        ingredients: ["Rice", "Peas", "Fruit", "Seeds"],
        calories: Math.round(dailyCalories * 0.25),
        protein: Math.round(proteinGrams * 0.25),
        carbs: Math.round(carbsGrams * 0.3),
        fat: Math.round(fatGrams * 0.2),
        prepTime: 10,
        budgetTier: profile?.budgetTier ?? "medium",
        cuisineTag: profile?.cuisinePreference ?? "balanced",
      },
      {
        type: "lunch",
        name: "Balanced power bowl",
        ingredients: ["Lentils", "Rice", "Vegetables", "Olive oil"],
        calories: Math.round(dailyCalories * 0.35),
        protein: Math.round(proteinGrams * 0.35),
        carbs: Math.round(carbsGrams * 0.35),
        fat: Math.round(fatGrams * 0.3),
        prepTime: 20,
        budgetTier: profile?.budgetTier ?? "medium",
        cuisineTag: profile?.cuisinePreference ?? "balanced",
      },
      {
        type: "dinner",
        name: "Recovery dinner plate",
        ingredients: ["Beans", "Vegetables", "Potatoes"],
        calories: Math.round(dailyCalories * 0.3),
        protein: Math.round(proteinGrams * 0.3),
        carbs: Math.round(carbsGrams * 0.25),
        fat: Math.round(fatGrams * 0.3),
        prepTime: 25,
        budgetTier: profile?.budgetTier ?? "medium",
        cuisineTag: profile?.cuisinePreference ?? "balanced",
      },
      {
        type: "snack",
        name: "Protein snack",
        ingredients: ["Peas", "Fruit", "Seeds"],
        calories: Math.round(dailyCalories * 0.1),
        protein: Math.round(proteinGrams * 0.1),
        carbs: Math.round(carbsGrams * 0.1),
        fat: Math.round(fatGrams * 0.2),
        prepTime: 5,
        budgetTier: profile?.budgetTier ?? "medium",
        cuisineTag: profile?.cuisinePreference ?? "balanced",
      },
    ],
    hydration: {
      dailyLiters: Number(Math.min(6,Math.max(2.2, weight * 0.035)).toFixed(1)),
      reminders: ["Drink 500ml on waking", "Sip water before each meal", "Hydrate after training"],
    },
    groceryList: [
      { item: "Lentils and beans", quantity: "1 week supply", estimatedCost: "variable" },
      { item: "Rice", quantity: "1 week supply", estimatedCost: "variable" },
      { item: "Seasonal vegetables", quantity: "1 week supply", estimatedCost: "variable" },
      { item: "Fruit", quantity: "1 week supply", estimatedCost: "variable" },
    ],
    mealTimingAdvice: "Aim for 3 main meals and 1 snack spaced across the day, with protein at each meal.",
    notes: "Adjust portion sizes weekly based on adherence, recovery, and body-weight trend.",
  };
}

export async function ensureAchievements(userId: string) {
  if (!isDatabaseConfigured) {
    return {
      allAchievements: await ensureAchievementCatalog(),
      awards: [],
      stats: DEMO_ACHIEVEMENT_STATS,
    };
  }

  const [allAchievements, sessions, currentAwards] = await Promise.all([
    ensureAchievementCatalog(),
    db.query.workoutSessions.findMany({ where: eq(workoutSessions.userId, userId) }),
    db.query.userAchievements.findMany({ where: eq(userAchievements.userId, userId) }),
  ]);
  const sessionIds = sessions.map((session) => session.id);
  const reps = sessionIds.length
    ? await db.query.exerciseReps.findMany({
        where: inArray(exerciseReps.sessionId, sessionIds),
      })
    : [];

  const awardedIds = new Set(currentAwards.map((award) => award.achievementId));
  const totalCalories = sessions.reduce((sum, session) => sum + (session.caloriesBurned ?? 0), 0);
  const danceSessionsCount = sessions.filter((session) => session.type === "dance").length;
  const strengthSessionsCount = sessions.filter((session) => session.type === "strength").length;
  const scorecardCounts = countScorecardReps(reps);
  const stats: AchievementStats = {
    totalSessions: sessions.length,
    totalCalories,
    totalReps: sessions.reduce((sum, session) => sum + (session.totalReps ?? 0), 0),
    danceSessionsCount,
    strengthSessionsCount,
    bestCompositeScore: Math.max(0, ...sessions.map((session) => session.compositeScore ?? 0)),
    highScoreSessions: sessions.filter((session) => (session.compositeScore ?? 0) >= 85).length,
    curlScorecards: scorecardCounts.curl,
    squatScorecards: scorecardCounts.squat,
    danceScoreSessions: countDanceEvidenceSessions(sessions),
    currentStreak: calculateStreak(sessions.map((session) => session.date)),
    weeklySessionPeak: calculateWeeklySessionPeak(sessions.map((session) => session.date)),
  };
  const progressByName = buildAchievementProgress(stats);

  if (isDemoUser(userId)) {
    return { allAchievements, awards: [], stats };
  }

  for (const achievement of allAchievements) {
    const progress = progressByName[achievement.name] ?? 0;
    const existing = currentAwards.find((award) => award.achievementId === achievement.id);
    if (existing) {
      await db
        .update(userAchievements)
        .set({ progress })
        .where(eq(userAchievements.id, existing.id));
      continue;
    }

    if (achievement.threshold != null && progress >= achievement.threshold && !awardedIds.has(achievement.id)) {
      await db.insert(userAchievements).values({
        id: nanoid(),
        userId,
        achievementId: achievement.id,
        progress,
        unlockedAt: new Date(),
      });
    }
  }

  const awards = await db.query.userAchievements.findMany({ where: eq(userAchievements.userId, userId) });
  return { allAchievements, awards, stats };
}

export async function getDanceRoutineDemo() {
  if (!isDatabaseConfigured) {
    return null;
  }

  return db.query.danceRoutines.findFirst({
    orderBy: [desc(danceRoutines.createdAt)],
  });
}

export async function getNutritionOverview(userId: string) {
  if (!isDatabaseConfigured) {
    return {
      plan: DEMO_DASHBOARD_SUMMARY.activeNutritionPlan
        ? {
            id: DEMO_DASHBOARD_SUMMARY.activeNutritionPlan.id,
            userId,
            name: DEMO_DASHBOARD_SUMMARY.activeNutritionPlan.name,
            dailyCalories: DEMO_DASHBOARD_SUMMARY.activeNutritionPlan.dailyCalories,
            proteinGrams: DEMO_DASHBOARD_SUMMARY.activeNutritionPlan.proteinGrams,
            carbsGrams: DEMO_DASHBOARD_SUMMARY.activeNutritionPlan.carbsGrams,
            fatGrams: DEMO_DASHBOARD_SUMMARY.activeNutritionPlan.fatGrams,
          }
        : null,
      todaysFood: [],
    };
  }

  const [plan, todaysFood] = await Promise.all([
    db.query.nutritionPlans.findFirst({
      where: and(eq(nutritionPlans.userId, userId), eq(nutritionPlans.isActive, true)),
      orderBy: [desc(nutritionPlans.createdAt)],
    }),
    db.query.foodLog.findMany({
      where: eq(foodLog.userId, userId),
      orderBy: [desc(foodLog.date)],
      limit: 40,
    }),
  ]);

  return {
    plan,
    todaysFood,
  };
}
