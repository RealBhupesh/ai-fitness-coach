import { describe, expect, it } from "vitest";
import { buildDemoProfile } from "@/lib/dummy-auth";
import { buildFallbackNutritionPlan,buildFallbackWorkoutPlan } from "@/lib/server/app-data";
import { validateNutritionPlan,validateWorkoutPlan } from "@/lib/ai/plan-validation";
describe("plan constraints",()=>{
 it("rejects forbidden ingredients and contradictory diets",()=>{
  const profile=buildDemoProfile({dietaryPrefs:["vegan"],allergies:"peanuts"});
  const plan=buildFallbackNutritionPlan(profile);expect(()=>validateNutritionPlan(plan,profile)).not.toThrow();
  plan.meals[0].ingredients.push("Peanuts");expect(()=>validateNutritionPlan(plan,profile)).toThrow();
  plan.meals[0].ingredients=["Rice","Milk"];expect(()=>validateNutritionPlan(plan,profile)).toThrow();
 });
 it("rejects inaccessible equipment and malformed schedules",()=>{
  const profile=buildDemoProfile({equipmentAccess:[],experience:"beginner"});const plan=buildFallbackWorkoutPlan(profile);
  plan.weeklySchedule[0].exercises[0].exerciseName="Barbell squat";expect(()=>validateWorkoutPlan(plan,profile)).toThrow();
  expect(()=>validateWorkoutPlan({weeklySchedule:[]},profile)).toThrow();
 });
});
