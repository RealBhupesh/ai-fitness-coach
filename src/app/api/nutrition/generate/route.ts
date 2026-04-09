import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { nutritionPlans } from "@/db/schema";
import { generateNutritionPlan } from "@/lib/ai/coach";
import { requireServerSession } from "@/lib/auth/session";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { getAppProfile } from "@/lib/server/app-data";
import { toJson } from "@/lib/utils/json";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "generate-nutrition-plan",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 6,
      windowMs: 5 * 60_000,
    });
    if (guard) {
      return guard;
    }

    const profile = await getAppProfile(session.user.id);
    const generated = await generateNutritionPlan(profile);
    const planData = generated.plan;

    const existingActive = await db.query.nutritionPlans.findFirst({
      where: and(eq(nutritionPlans.userId, session.user.id), eq(nutritionPlans.isActive, true)),
    });
    if (existingActive) {
      await db.update(nutritionPlans).set({ isActive: false }).where(eq(nutritionPlans.id, existingActive.id));
    }

    const record = {
      id: nanoid(),
      userId: session.user.id,
      name: `${profile?.goals[0] ?? "balanced"} nutrition plan`,
      description: "Structured plan generated from your current profile and goals.",
      dailyCalories: planData.dailyCalories,
      proteinGrams: planData.macros.proteinGrams,
      carbsGrams: planData.macros.carbsGrams,
      fatGrams: planData.macros.fatGrams,
      meals: toJson(planData.meals),
      hydrationLiters: planData.hydration.dailyLiters,
      mealTiming: toJson(planData.hydration.reminders),
      groceryList: toJson(planData.groceryList),
      cuisineType: profile?.cuisinePreference ?? "balanced",
      budgetTier: profile?.budgetTier ?? "medium",
      isActive: true,
      isAiGenerated: true,
      createdAt: new Date(),
    };

    await db.insert(nutritionPlans).values(record);
    return NextResponse.json({ plan: planData, record, provider: generated.provider, model: generated.model });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to generate nutrition plan" }, { status });
  }
}
