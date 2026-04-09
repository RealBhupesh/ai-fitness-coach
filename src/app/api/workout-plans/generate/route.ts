import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workoutPlans } from "@/db/schema";
import { generateWorkoutPlan } from "@/lib/ai/coach";
import { requireServerSession } from "@/lib/auth/session";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { getAppProfile } from "@/lib/server/app-data";
import { toJson } from "@/lib/utils/json";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "generate-workout-plan",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 6,
      windowMs: 5 * 60_000,
    });
    if (guard) {
      return guard;
    }

    const profile = await getAppProfile(session.user.id);
    const generated = await generateWorkoutPlan(profile);
    const planData = generated.plan;

    const existingActive = await db.query.workoutPlans.findFirst({
      where: and(eq(workoutPlans.userId, session.user.id), eq(workoutPlans.isActive, true)),
    });

    if (existingActive) {
      await db.update(workoutPlans).set({ isActive: false }).where(eq(workoutPlans.id, existingActive.id));
    }

    const plan = {
      id: nanoid(),
      userId: session.user.id,
      name: planData.name,
      description: planData.description,
      goal: planData.goal,
      duration: planData.duration,
      daysPerWeek: planData.daysPerWeek,
      difficulty: planData.difficulty,
      weeklySchedule: toJson(planData.weeklySchedule),
      progressionRules: toJson(planData.progressionRules),
      regressionRules: toJson(planData.regressionRules),
      isActive: true,
      isAiGenerated: true,
      createdAt: new Date(),
    };

    await db.insert(workoutPlans).values(plan);
    return NextResponse.json({ plan: planData, record: plan, provider: generated.provider, model: generated.model });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to generate workout plan" }, { status });
  }
}
