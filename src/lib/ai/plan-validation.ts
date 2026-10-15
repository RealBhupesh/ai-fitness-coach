import { z } from "zod";
import type { AppUserProfile } from "@/lib/app-types";
const text = z.string().trim().min(1).max(600);
export const generatedWorkoutPlanSchema = z.object({
  name: text, description: text, goal: text, duration: z.number().int().min(4).max(16), daysPerWeek: z.number().int().min(1).max(7), difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  weeklySchedule: z.array(z.object({ day: text, focus: text, warmUp: z.array(text).max(5), coolDown: z.array(text).max(5), exercises: z.array(z.object({ exerciseName: text, sets: z.number().int().min(1).max(8), reps: z.number().int().min(1).max(30), restSeconds: z.number().int().min(15).max(180) })).min(1).max(6) })).min(1).max(7),
  progressionRules: z.array(text).min(1).max(6), regressionRules: z.array(text).min(1).max(6),
});
export const generatedNutritionPlanSchema = z.object({
  dailyCalories: z.number().int().min(1400).max(4200), macros: z.object({ proteinGrams: z.number().min(0).max(320), carbsGrams: z.number().min(0).max(550), fatGrams: z.number().min(0).max(180) }),
  meals: z.array(z.object({ type: z.enum(["breakfast", "lunch", "dinner", "snack"]), name: text, ingredients: z.array(text).min(1).max(12), calories: z.number().min(0).max(1600), protein: z.number().min(0).max(120), carbs: z.number().min(0).max(180), fat: z.number().min(0).max(80), prepTime: z.number().min(0).max(120), budgetTier: text, cuisineTag: text })).min(3).max(6),
  hydration: z.object({ dailyLiters: z.number().min(1.5).max(6), reminders: z.array(text).max(6) }), groceryList: z.array(z.object({ item: text, quantity: text, estimatedCost: text })).max(20), mealTimingAdvice: text, notes: text,
});
function dietaryTerms(profile: AppUserProfile | null) {
  const terms = (profile?.allergies || "").split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const synonyms: Record<string,string[]> = { dairy: ["milk", "cheese", "yogurt", "whey", "butter"], milk: ["milk", "cheese", "yogurt", "whey", "butter"], nuts: ["peanut", "almond", "walnut", "cashew"], gluten: ["wheat", "barley", "rye", "bread", "pasta"] };
  let blocked = terms.flatMap(t => [t, ...(synonyms[t] || [])]);
  if (profile?.dietaryPrefs.some(p => p === "vegan" || p === "vegetarian")) blocked = [...blocked, "chicken", "beef", "pork", "fish", "salmon", "tuna", "turkey", "shrimp"];
  if (profile?.dietaryPrefs.includes("vegan")) blocked = [...blocked, "milk", "cheese", "yogurt", "whey", "egg", "honey", "butter"];
  return blocked;
}
export function validateNutritionPlan(value: unknown, profile: AppUserProfile | null) {
  const plan = generatedNutritionPlanSchema.parse(value);
  const ingredients = [...plan.meals.flatMap(m => [m.name, ...m.ingredients]), ...plan.groceryList.map(g => g.item)].join(" ").toLowerCase();
  const words = ingredients.replace(/[^a-z0-9 ]/g, " ").split(/\s+/);
  if (dietaryTerms(profile).some(term => term.includes(" ") ? ingredients.includes(term) : words.some(word => word === term || word === term + "s"))) throw new Error("DIETARY_CONSTRAINT_VIOLATION");
  if (profile?.dietaryPrefs.includes("vegan") && profile.dietaryPrefs.includes("omnivore")) throw new Error("CONTRADICTORY_DIETARY_PREFERENCES");
  return plan;
}
export function validateWorkoutPlan(value: unknown, profile: AppUserProfile | null) {
  const plan = generatedWorkoutPlanSchema.parse(value);
  const equipment = profile?.equipmentAccess.join(" ").toLowerCase() || "";
  const exerciseNames = plan.weeklySchedule.flatMap(day => day.exercises.map(e => e.exerciseName.toLowerCase()));
  for (const item of ["dumbbell", "barbell", "kettlebell", "bench", "cable", "machine", "resistance band"]) {
    if (!equipment.includes(item) && exerciseNames.some(name => name.includes(item))) throw new Error("EQUIPMENT_CONSTRAINT_VIOLATION");
  }
  if (profile?.experience === "beginner" && plan.difficulty !== "beginner") throw new Error("EXPERIENCE_CONSTRAINT_VIOLATION");
  if (profile?.workoutFrequency && plan.daysPerWeek > profile.workoutFrequency) throw new Error("FREQUENCY_CONSTRAINT_VIOLATION");
  return plan;
}
