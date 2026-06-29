import { boolean, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { mode: "date" }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { mode: "date" }).defaultNow().notNull();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  age: integer("age"),
  gender: text("gender"),
  height: real("height"),
  weight: real("weight"),
  targetWeight: real("target_weight"),
  fitnessLevel: text("fitness_level"),
  activityLevel: text("activity_level"),
  goals: text("goals"),
  profileType: text("profile_type"),
  primarySport: text("primary_sport"),
  trainingStyle: text("training_style"),
  readinessAssumptions: text("readiness_assumptions"),
  coachingConstraints: text("coaching_constraints"),
  baselineMetrics: text("baseline_metrics"),
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
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const exercises = pgTable("exercises", {
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
  isActive: boolean("is_active").default(true),
  createdAt: createdAt(),
});

export const danceStyles = pgTable("dance_styles", {
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
  isActive: boolean("is_active").default(true),
  createdAt: createdAt(),
});

export const danceRoutines = pgTable("dance_routines", {
  id: text("id").primaryKey(),
  danceStyleId: text("dance_style_id").notNull().references(() => danceStyles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationMs: integer("duration_ms").notNull(),
  checkpoints: text("checkpoints").notNull(),
  difficulty: text("difficulty").notNull(),
  musicUrl: text("music_url"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: createdAt(),
});

export const workoutPlans = pgTable("workout_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  goal: text("goal").notNull(),
  duration: integer("duration").notNull(),
  daysPerWeek: integer("days_per_week").notNull(),
  difficulty: text("difficulty").notNull(),
  weeklySchedule: text("weekly_schedule"),
  progressionRules: text("progression_rules"),
  regressionRules: text("regression_rules"),
  isActive: boolean("is_active").default(true),
  isAiGenerated: boolean("is_ai_generated").default(false),
  createdAt: createdAt(),
});

export const workoutSessions = pgTable("workout_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: text("plan_id").references(() => workoutPlans.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  exerciseType: text("exercise_type"),
  date: timestamp("date", { mode: "date" }).notNull(),
  duration: integer("duration"),
  caloriesBurned: integer("calories_burned"),
  notes: text("notes"),
  rating: integer("rating"),
  mood: text("mood"),
  completed: boolean("completed").default(false),
  compositeScore: integer("composite_score"),
  scoringBreakdown: text("scoring_breakdown"),
  summary: text("summary"),
  summaryPayload: text("summary_payload"),
  totalReps: integer("total_reps"),
  avgRepDurationMs: integer("avg_rep_duration_ms"),
  fatigueCurve: text("fatigue_curve"),
  frameQualityStats: text("frame_quality_stats"),
  issueHistory: text("issue_history"),
  phaseHistory: text("phase_history"),
  telemetry: text("telemetry"),
  postSetAnalysis: text("post_set_analysis"),
  createdAt: createdAt(),
});

export const workoutExercises = pgTable("workout_exercises", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  sets: integer("sets"),
  reps: integer("reps"),
  weight: real("weight"),
  duration: integer("duration"),
  distance: real("distance"),
  completed: boolean("completed").default(false),
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

export const exerciseReps = pgTable("exercise_reps", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  repNumber: integer("rep_number").notNull(),
  phase: text("phase").notNull(),
  formScore: integer("form_score"),
  romScore: integer("rom_score"),
  tempoScore: integer("tempo_score"),
  safetyScore: integer("safety_score"),
  corrections: text("corrections"),
  durationMs: integer("duration_ms"),
  timestamps: text("timestamps"),
  curlScorecard: text("curl_scorecard"),
  squatScorecard: text("squat_scorecard"),
  createdAt: createdAt(),
});

export const sessionFeedbackEvents = pgTable("session_feedback_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  timestamp: integer("timestamp").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  source: text("source").notNull(),
  createdAt: createdAt(),
});

export const progressTracking = pgTable("progress_tracking", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date", { mode: "date" }).notNull(),
  weight: real("weight"),
  bodyFat: real("body_fat"),
  muscleMass: real("muscle_mass"),
  measurements: text("measurements"),
  exerciseScores: text("exercise_scores"),
  adherence: integer("adherence"),
  photos: text("photos"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  icon: text("icon"),
  threshold: integer("threshold"),
  points: integer("points").default(0),
  createdAt: createdAt(),
});

export const userAchievements = pgTable("user_achievements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at", { mode: "date" }).defaultNow().notNull(),
  progress: integer("progress").default(0),
});

export const danceCourseProgress = pgTable("dance_course_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  routineId: text("routine_id").notNull(),
  segmentId: text("segment_id").notNull(),
  status: text("status").notNull().default("not_started"),
  bestScore: integer("best_score").default(0),
  bestReliability: integer("best_reliability").default(0),
  attempts: integer("attempts").default(0),
  completedAt: timestamp("completed_at", { mode: "date" }),
  lastAttemptAt: timestamp("last_attempt_at", { mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const danceCourseAttempts = pgTable("dance_course_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  routineId: text("routine_id").notNull(),
  segmentId: text("segment_id").notNull(),
  mode: text("mode").notNull().default("full_routine"),
  sourceSessionId: text("source_session_id").references(() => workoutSessions.id, { onDelete: "set null" }),
  score: integer("score").notNull(),
  reliability: integer("reliability").notNull(),
  timingScore: integer("timing_score").default(0),
  transitionScore: integer("transition_score").default(0),
  durationSeconds: integer("duration_seconds").default(0),
  completed: boolean("completed").default(false),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const coachMemories = pgTable("coach_memories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  weakMetrics: text("weak_metrics"),
  strongMetrics: text("strong_metrics"),
  recurringIssues: text("recurring_issues"),
  recommendedFocus: text("recommended_focus"),
  preferredNextAction: text("preferred_next_action"),
  lastDecision: text("last_decision"),
  weeklySummary: text("weekly_summary"),
  updatedAt: updatedAt(),
  createdAt: createdAt(),
});

export const nutritionPlans = pgTable("nutrition_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  isActive: boolean("is_active").default(true),
  isAiGenerated: boolean("is_ai_generated").default(false),
  startDate: timestamp("start_date", { mode: "date" }),
  endDate: timestamp("end_date", { mode: "date" }),
  createdAt: createdAt(),
});

export const foodLog = pgTable("food_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date", { mode: "date" }).notNull(),
  mealType: text("meal_type").notNull(),
  foodName: text("food_name").notNull(),
  calories: integer("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  portion: text("portion"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  summary: text("summary"),
  context: text("context"),
  lastMessageAt: timestamp("last_message_at", { mode: "date" }),
  createdAt: createdAt(),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => chatSessions.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  actionUrl: text("action_url"),
  createdAt: createdAt(),
});

export const verificationTokens = pgTable("verification_tokens", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
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
export type DanceCourseProgress = typeof danceCourseProgress.$inferSelect;
export type DanceCourseAttempt = typeof danceCourseAttempts.$inferSelect;
export type NutritionPlan = typeof nutritionPlans.$inferSelect;
export type FoodLog = typeof foodLog.$inferSelect;
export type NewFoodLog = typeof foodLog.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type CoachMemory = typeof coachMemories.$inferSelect;
