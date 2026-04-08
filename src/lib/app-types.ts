export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type Goal = "fat_loss" | "muscle_gain" | "endurance" | "mobility" | "dance_skill" | "general_fitness";
export type DietaryPref =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto"
  | "mediterranean";

export type CoachingTone = "strict" | "friendly" | "motivational";
export type BudgetTier = "low" | "medium" | "high";

export interface AppUserProfile {
  userId: string;
  email?: string;
  name: string;
  age?: number;
  gender?: "male" | "female" | "non_binary" | "prefer_not_to_say" | "other";
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  experience: ExperienceLevel;
  goals: Goal[];
  dietaryPrefs: DietaryPref[];
  injuries: string[];
  painPoints: string[];
  equipmentAccess: string[];
  allergies?: string;
  workoutFrequency?: number;
  workoutDuration?: number;
  cuisinePreference?: string;
  budgetTier?: BudgetTier;
  coachingTone?: CoachingTone;
  sleepHours?: number;
  onboardingCompleted: boolean;
  lastUpdated?: string;
}

export interface DashboardSummary {
  streak: number;
  totalWorkouts: number;
  totalMinutes: number;
  totalCalories: number;
  averageScore: number;
  adherence: number;
  recentSessions: Array<{
    id: string;
    type: string;
    exerciseType?: string | null;
    date: string;
    duration: number;
    caloriesBurned: number;
    compositeScore: number;
    summary?: string | null;
  }>;
  weightTrend: Array<{ date: string; weight: number }>;
  activePlan?: {
    id: string;
    name: string;
    progress: number;
    currentWeek: number;
    daysPerWeek: number;
  } | null;
  activeNutritionPlan?: {
    id: string;
    name: string;
    dailyCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  } | null;
}
