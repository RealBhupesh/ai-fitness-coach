import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AppUserProfile, DashboardSummary, Goal } from "@/lib/app-types";
import { db } from "@/db";
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

export async function getAppProfile(userId: string) {
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

export async function ensureChatSession(userId: string) {
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

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
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
  const dailyCalories =
    profile?.goals[0] === "muscle_gain" ? Math.round(weight * 33) : profile?.goals[0] === "fat_loss" ? Math.round(weight * 27) : Math.round(weight * 30);
  const proteinGrams = Math.round(weight * 1.8);
  const fatGrams = Math.round((dailyCalories * 0.25) / 9);
  const carbsGrams = Math.round((dailyCalories - proteinGrams * 4 - fatGrams * 9) / 4);
  return {
    dailyCalories,
    macros: { proteinGrams, carbsGrams, fatGrams },
    meals: [
      {
        type: "breakfast",
        name: "Protein oats bowl",
        ingredients: ["Oats", "Protein powder", "Fruit", "Seeds"],
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
        ingredients: ["Lean protein", "Rice or roti", "Vegetables", "Yogurt or sauce"],
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
        ingredients: ["Protein source", "Vegetables", "Complex carbs"],
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
        ingredients: ["Greek yogurt or tofu", "Fruit", "Nuts"],
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
      dailyLiters: Number(Math.max(2.2, weight * 0.035).toFixed(1)),
      reminders: ["Drink 500ml on waking", "Sip water before each meal", "Hydrate after training"],
    },
    groceryList: [
      { item: "Lean protein", quantity: "1 week supply", estimatedCost: "variable" },
      { item: "Whole grains", quantity: "1 week supply", estimatedCost: "variable" },
      { item: "Seasonal vegetables", quantity: "1 week supply", estimatedCost: "variable" },
      { item: "Fruit", quantity: "1 week supply", estimatedCost: "variable" },
    ],
    mealTimingAdvice: "Aim for 3 main meals and 1 snack spaced across the day, with protein at each meal.",
    notes: "Adjust portion sizes weekly based on adherence, recovery, and body-weight trend.",
  };
}

export async function ensureAchievements(userId: string) {
  const [allAchievements, sessions, currentAwards] = await Promise.all([
    db.query.achievements.findMany({ orderBy: [desc(achievements.points)] }),
    db.query.workoutSessions.findMany({ where: eq(workoutSessions.userId, userId) }),
    db.query.userAchievements.findMany({ where: eq(userAchievements.userId, userId) }),
  ]);

  const awardedIds = new Set(currentAwards.map((award) => award.achievementId));
  const totalCalories = sessions.reduce((sum, session) => sum + (session.caloriesBurned ?? 0), 0);
  const danceSessionsCount = sessions.filter((session) => session.type === "dance").length;
  const strengthSessionsCount = sessions.filter((session) => session.type === "strength").length;
  const streak = calculateStreak(sessions.map((session) => session.date));

  const progressByName: Record<string, number> = {
    "First Steps": sessions.length,
    "Week Warrior": streak,
    "Month Master": streak,
    "Century Club": sessions.length,
    "Calorie Crusher": totalCalories,
    "Dance Master": danceSessionsCount,
    "Strength Legend": strengthSessionsCount,
    "Perfect Week": streak >= 7 ? 1 : 0,
    "Early Bird": Math.floor(sessions.length / 3),
    Transformation: Math.min(90, sessions.length),
  };

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
  return { allAchievements, awards };
}

export async function getDanceRoutineDemo() {
  return db.query.danceRoutines.findFirst({
    orderBy: [desc(danceRoutines.createdAt)],
  });
}

export async function getNutritionOverview(userId: string) {
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
