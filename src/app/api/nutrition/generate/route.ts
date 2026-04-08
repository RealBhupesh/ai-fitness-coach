import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { nutritionPlans } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { buildFallbackNutritionPlan, getAppProfile } from "@/lib/server/app-data";
import { toJson } from "@/lib/utils/json";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const profile = await getAppProfile(session.user.id);
    const generated = buildFallbackNutritionPlan(profile);

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
      dailyCalories: generated.dailyCalories,
      proteinGrams: generated.macros.proteinGrams,
      carbsGrams: generated.macros.carbsGrams,
      fatGrams: generated.macros.fatGrams,
      meals: toJson(generated.meals),
      hydrationLiters: generated.hydration.dailyLiters,
      mealTiming: toJson(generated.hydration.reminders),
      groceryList: toJson(generated.groceryList),
      cuisineType: profile?.cuisinePreference ?? "balanced",
      budgetTier: profile?.budgetTier ?? "medium",
      isActive: true,
      isAiGenerated: true,
      createdAt: new Date(),
    };

    await db.insert(nutritionPlans).values(record);
    return NextResponse.json({ plan: generated, record });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
