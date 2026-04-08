import { z } from "zod";

export const goalSchema = z.enum([
  "fat_loss",
  "muscle_gain",
  "endurance",
  "mobility",
  "dance_skill",
  "general_fitness",
]);

export const dietaryPrefSchema = z.enum([
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "keto",
  "mediterranean",
]);

export const profileInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  age: z.number().int().min(10).max(100).optional(),
  gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say", "other"]).optional(),
  heightCm: z.number().min(50).max(250).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  targetWeightKg: z.number().min(20).max(400).optional(),
  experience: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  goals: z.array(goalSchema).max(6).optional(),
  dietaryPrefs: z.array(dietaryPrefSchema).max(6).optional(),
  injuries: z.array(z.string().min(1).max(80)).max(20).optional(),
  painPoints: z.array(z.string().min(1).max(80)).max(20).optional(),
  equipmentAccess: z.array(z.string().min(1).max(80)).max(20).optional(),
  allergies: z.string().max(240).optional(),
  workoutFrequency: z.number().int().min(1).max(7).optional(),
  workoutDuration: z.number().int().min(5).max(240).optional(),
  cuisinePreference: z.string().max(120).optional(),
  budgetTier: z.enum(["low", "medium", "high"]).optional(),
  coachingTone: z.enum(["strict", "friendly", "motivational"]).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const progressInputSchema = z.object({
  weight: z.number().min(20).max(400).optional(),
  bodyFat: z.number().min(0).max(100).optional(),
  muscleMass: z.number().min(0).max(300).optional(),
  measurements: z.record(z.string(), z.number()).optional(),
  exerciseScores: z.record(z.string(), z.number()).optional(),
  adherence: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const foodLogInputSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  foodName: z.string().min(1).max(120),
  calories: z.number().int().min(0).max(5000),
  protein: z.number().min(0).max(500).default(0),
  carbs: z.number().min(0).max(500).default(0),
  fat: z.number().min(0).max(300).default(0),
  portion: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});

export const chatInputSchema = z.object({
  message: z.string().min(1).max(4000),
});

export const coachFeedbackInputSchema = z.object({
  exerciseType: z.string().min(1).max(80),
  repsSoFar: z.number().int().min(0),
  phase: z.string().max(40).optional(),
  confidence: z.number().min(0).max(1).optional(),
  currentIssues: z.array(z.string()).max(10).default([]),
  currentMetrics: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        score: z.number().min(0).max(100),
        detail: z.string().min(1).max(200),
        value: z.number().optional(),
        target: z.string().max(60).optional(),
      }),
    )
    .max(12)
    .default([]),
  recentScores: z
    .array(
      z.object({
        form: z.number().min(0).max(100),
        rom: z.number().min(0).max(100),
        tempo: z.number().min(0).max(100),
        safety: z.number().min(0).max(100),
      }),
    )
    .max(20)
    .default([]),
});

export const summarizeInputSchema = z.object({
  sessionId: z.string().min(1).optional(),
  sessionSummary: z.string().min(1).max(5000).optional(),
  exerciseType: z.string().max(80).optional(),
  durationMinutes: z.number().int().min(0).max(720).optional(),
  totalReps: z.number().int().min(0).max(5000).optional(),
  scoringBreakdown: z
    .object({
      form: z.number().min(0).max(100).optional(),
      rom: z.number().min(0).max(100).optional(),
      tempo: z.number().min(0).max(100).optional(),
      stability: z.number().min(0).max(100).optional(),
      symmetry: z.number().min(0).max(100).optional(),
      consistency: z.number().min(0).max(100).optional(),
      endurance: z.number().min(0).max(100).optional(),
      safety: z.number().min(0).max(100).optional(),
    })
    .optional(),
  topIssues: z.array(z.string().min(1).max(220)).max(12).optional(),
  topStrengths: z.array(z.string().min(1).max(220)).max(12).optional(),
});

export const workoutPlanCreateSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().min(1).max(80),
  duration: z.number().int().min(1).max(52),
  daysPerWeek: z.number().int().min(1).max(7),
  difficulty: z.string().min(1).max(40),
});

export const workoutSessionInputSchema = z.object({
  type: z.string().min(1).max(80),
  exerciseType: z.string().max(80).optional(),
  duration: z.number().int().min(0).max(720).default(0),
  caloriesBurned: z.number().int().min(0).max(10000).default(0),
  totalReps: z.number().int().min(0).max(5000).default(0),
  compositeScore: z.number().int().min(0).max(100).default(0),
  scoringBreakdown: z
    .object({
      form: z.number().min(0).max(100).default(0),
      rom: z.number().min(0).max(100).default(0),
      tempo: z.number().min(0).max(100).default(0),
      stability: z.number().min(0).max(100).default(0),
      symmetry: z.number().min(0).max(100).default(0),
      consistency: z.number().min(0).max(100).default(0),
      endurance: z.number().min(0).max(100).default(0),
      safety: z.number().min(0).max(100).default(0),
    })
    .default({
      form: 0,
      rom: 0,
      tempo: 0,
      stability: 0,
      symmetry: 0,
      consistency: 0,
      endurance: 0,
      safety: 0,
    }),
  fatigueCurve: z.array(z.number().min(0).max(100)).default([]),
  summary: z.string().max(4000).optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        sets: z.number().int().min(0).default(0),
        reps: z.number().int().min(0).default(0),
        weight: z.number().min(0).optional(),
        duration: z.number().int().min(0).optional(),
        formScore: z.number().int().min(0).max(100).default(0),
        romScore: z.number().int().min(0).max(100).default(0),
        tempoScore: z.number().int().min(0).max(100).default(0),
        safetyScore: z.number().int().min(0).max(100).default(0),
        corrections: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  repData: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        repNumber: z.number().int().min(1),
        phase: z.string().min(1).default("concentric"),
        formScore: z.number().int().min(0).max(100).default(0),
        romScore: z.number().int().min(0).max(100).default(0),
        tempoScore: z.number().int().min(0).max(100).default(0),
        safetyScore: z.number().int().min(0).max(100).default(0),
        corrections: z.array(z.string()).default([]),
        durationMs: z.number().int().min(0).default(0),
        timestamps: z
          .object({
            startMs: z.number().int().min(0).optional(),
            bottomMs: z.number().int().min(0).optional(),
            endMs: z.number().int().min(0).optional(),
          })
          .optional(),
      }),
    )
    .default([]),
  feedbackEvents: z
    .array(
      z.object({
        timestamp: z.number().int().min(0),
        type: z.string().min(1).max(40),
        message: z.string().min(1).max(500),
        severity: z.enum(["critical", "warning", "info"]),
        source: z.enum(["rule_engine", "llm_coach", "system"]),
      }),
    )
    .default([]),
});
