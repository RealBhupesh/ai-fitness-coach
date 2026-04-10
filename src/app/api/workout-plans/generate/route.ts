import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workoutPlans } from "@/db/schema";
import { generateWorkoutPlan } from "@/lib/ai/coach";
import { requireServerSession } from "@/lib/auth/session";
import { buildDemoProfile, DEMO_WORKOUT_PLAN_COOKIE_NAME, getDemoProfileFromCookie, isDemoUser, saveDemoWorkoutPlan } from "@/lib/dummy-auth";
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

    const profile = isDemoUser(session.user.id)
      ? (getDemoProfileFromCookie(request.headers.get("cookie") || "") ?? buildDemoProfile())
      : await getAppProfile(session.user.id);
    const generated = await generateWorkoutPlan(profile);
    const planData = generated.plan;

    if (isDemoUser(session.user.id)) {
      const record = {
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
      saveDemoWorkoutPlan(record);
      const response = NextResponse.json({ plan: planData, record, provider: generated.provider, model: generated.model });
      response.cookies.set(DEMO_WORKOUT_PLAN_COOKIE_NAME, encodeURIComponent(JSON.stringify(record)), {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
      return response;
    }

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
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : error instanceof Error ? error.message : "Failed to generate workout plan" }, { status });
  }
}
