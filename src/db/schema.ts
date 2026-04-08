import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  age: integer("age"),
  gender: text("gender"),
  height: real("height"),
  weight: real("weight"),
  targetWeight: real("target_weight"),
  fitnessLevel: text("fitness_level"),
  activityLevel: text("activity_level"),
  goals: text("goals"),
  medicalConditions: text("medical_conditions"),
  injuries: text("injuries"),
  painPoints: text("pain_points"),
  dietaryPreferences: text("dietary_preferences"),
  allergies: text("allergies"),
  equipmentAccess: text("equipment_access"),
  workoutFrequency: integer("workout_frequency"),
  workoutDuration: integer("workout_duration"),
  preferredWorkoutTime: text("preferred_workout_time"),
  motivation: text("motivation"),
  sleepHours: real("sleep_hours"),
  budgetTier: text("budget_tier"),
  cuisinePreference: text("cuisine_preference"),
  coachingTone: text("coaching_tone"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  muscleGroup: text("muscle_group"),
  equipment: text("equipment"),
  difficulty: text("difficulty").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  calories: integer("calories"),
  formPoints: text("form_points"),
  commonMistakes: text("common_mistakes"),
  modifications: text("modifications"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const danceStyles = sqliteTable("dance_styles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  difficulty: text("difficulty").notNull(),
  intensity: text("intensity").notNull(),
  caloriesPerHour: integer("calories_per_hour"),
  musicStyle: text("music_style"),
  benefits: text("benefits"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const danceRoutines = sqliteTable("dance_routines", {
  id: text("id").primaryKey(),
  danceStyleId: text("dance_style_id")
    .notNull()
    .references(() => danceStyles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationMs: integer("duration_ms").notNull(),
  checkpoints: text("checkpoints").notNull(),
  difficulty: text("difficulty").notNull(),
  musicUrl: text("music_url"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const workoutPlans = sqliteTable("workout_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  goal: text("goal").notNull(),
  duration: integer("duration").notNull(),
  daysPerWeek: integer("days_per_week").notNull(),
  difficulty: text("difficulty").notNull(),
  weeklySchedule: text("weekly_schedule"),
  progressionRules: text("progression_rules"),
  regressionRules: text("regression_rules"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isAiGenerated: integer("is_ai_generated", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: text("plan_id").references(() => workoutPlans.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  exerciseType: text("exercise_type"),
  date: integer("date", { mode: "timestamp" }).notNull(),
  duration: integer("duration"),
  caloriesBurned: integer("calories_burned"),
  notes: text("notes"),
  rating: integer("rating"),
  mood: text("mood"),
  completed: integer("completed", { mode: "boolean" }).default(false),
  compositeScore: integer("composite_score"),
  scoringBreakdown: text("scoring_breakdown"),
  summary: text("summary"),
  totalReps: integer("total_reps"),
  avgRepDurationMs: integer("avg_rep_duration_ms"),
  fatigueCurve: text("fatigue_curve"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const workoutExercises = sqliteTable("workout_exercises", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  sets: integer("sets"),
  reps: integer("reps"),
  weight: real("weight"),
  duration: integer("duration"),
  distance: real("distance"),
  completed: integer("completed", { mode: "boolean" }).default(false),
  formScore: integer("form_score"),
  romScore: integer("rom_score"),
  tempoScore: integer("tempo_score"),
  stabilityScore: integer("stability_score"),
  symmetryScore: integer("symmetry_score"),
  consistencyScore: integer("consistency_score"),
  safetyScore: integer("safety_score"),
  corrections: text("corrections"),
  notes: text("notes"),
  order: integer("order").notNull(),
});

export const exerciseReps = sqliteTable("exercise_reps", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  repNumber: integer("rep_number").notNull(),
  phase: text("phase").notNull(),
  formScore: integer("form_score"),
  romScore: integer("rom_score"),
  tempoScore: integer("tempo_score"),
  safetyScore: integer("safety_score"),
  corrections: text("corrections"),
  durationMs: integer("duration_ms"),
  timestamps: text("timestamps"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const sessionFeedbackEvents = sqliteTable("session_feedback_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  timestamp: integer("timestamp").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const progressTracking = sqliteTable("progress_tracking", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  weight: real("weight"),
  bodyFat: real("body_fat"),
  muscleMass: real("muscle_mass"),
  measurements: text("measurements"),
  exerciseScores: text("exercise_scores"),
  adherence: integer("adherence"),
  photos: text("photos"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const achievements = sqliteTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  icon: text("icon"),
  threshold: integer("threshold"),
  points: integer("points").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const userAchievements = sqliteTable("user_achievements", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id")
    .notNull()
    .references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt: integer("unlocked_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  progress: integer("progress").default(0),
});

export const nutritionPlans = sqliteTable("nutrition_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  dailyCalories: integer("daily_calories").notNull(),
  proteinGrams: integer("protein_grams").notNull(),
  carbsGrams: integer("carbs_grams").notNull(),
  fatGrams: integer("fat_grams").notNull(),
  meals: text("meals"),
  hydrationLiters: real("hydration_liters"),
  mealTiming: text("meal_timing"),
  groceryList: text("grocery_list"),
  cuisineType: text("cuisine_type"),
  budgetTier: text("budget_tier"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isAiGenerated: integer("is_ai_generated", { mode: "boolean" }).default(false),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const foodLog = sqliteTable("food_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  mealType: text("meal_type").notNull(),
  foodName: text("food_name").notNull(),
  calories: integer("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  portion: text("portion"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  summary: text("summary"),
  context: text("context"),
  lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => chatSessions.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: integer("read", { mode: "boolean" }).default(false),
  actionUrl: text("action_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type DanceStyle = typeof danceStyles.$inferSelect;
export type DanceRoutine = typeof danceRoutines.$inferSelect;
export type WorkoutPlan = typeof workoutPlans.$inferSelect;
export type NewWorkoutPlan = typeof workoutPlans.$inferInsert;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type ExerciseRep = typeof exerciseReps.$inferSelect;
export type SessionFeedbackEvent = typeof sessionFeedbackEvents.$inferSelect;
export type ProgressTracking = typeof progressTracking.$inferSelect;
export type NewProgressTracking = typeof progressTracking.$inferInsert;
export type Achievement = typeof achievements.$inferSelect;
export type NutritionPlan = typeof nutritionPlans.$inferSelect;
export type FoodLog = typeof foodLog.$inferSelect;
export type NewFoodLog = typeof foodLog.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
