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
export type ProfileType = "beginner_rebuild" | "strength_focused" | "dance_athlete" | "fat_loss" | "mobility_rehab";

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
  profileType?: ProfileType;
  primarySport?: string;
  trainingStyle?: string;
  readinessAssumptions: string[];
  coachingConstraints: string[];
  baselineMetrics?: {
    readinessScore?: number;
    mobilityScore?: number;
    strengthScore?: number;
    danceTimingScore?: number;
    postureConfidence?: number;
  };
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

export interface ProfilePersona {
  id: string;
  title: string;
  profileType: ProfileType;
  name: string;
  summary: string;
  goals: Goal[];
  assumptions: string[];
  coachingPlan: string[];
  riskFlags: string[];
  sampleProfile: AppUserProfile;
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
  communityLeaderboard?: Array<{
    id: string;
    name: string;
    role: string;
    level: string;
    avatar: string;
    score: number;
    streak: number;
    sessions: number;
    danceScore: number;
    topMove: string;
    trend: "up" | "steady";
  }>;
  featuredAchievements?: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    points: number;
    threshold: number;
    progress: number;
    unlocked: boolean;
    unlockedDate: string | null;
  }>;
}
