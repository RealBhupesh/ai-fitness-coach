import { apiError, readJson } from "@/lib/server/api";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { workoutPlans } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { DEMO_WORKOUT_PLAN_COOKIE_NAME, getDemoWorkoutPlanFromCookie, isDemoUser } from "@/lib/dummy-auth";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { workoutPlanCreateSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";
import { buildFallbackWorkoutPlan } from "@/lib/server/app-data";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id) || !isDatabaseConfigured) {
      const demoPlan = getDemoWorkoutPlanFromCookie<Record<string, unknown>>(request.headers.get("cookie") || "");
      return NextResponse.json({ plans: demoPlan ? [demoPlan] : [] });
    }
    const plans = await db.query.workoutPlans.findMany({
      where: eq(workoutPlans.userId, session.user.id),
      orderBy: [desc(workoutPlans.createdAt)],
    });

    return NextResponse.json({ plans });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "workout-plans",
      key: session.user.id,
      limit: 12,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = workoutPlanCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const fallback = buildFallbackWorkoutPlan(null);
    const record = {
      id: nanoid(),
      userId: session.user.id,
      name: parsed.data.name,
      description: `${parsed.data.duration}-week ${parsed.data.goal.replace(/_/g, " ")} program`,
      goal: parsed.data.goal,
      duration: parsed.data.duration,
      daysPerWeek: parsed.data.daysPerWeek,
      difficulty: parsed.data.difficulty,
      weeklySchedule: toJson(fallback.weeklySchedule.slice(0, parsed.data.daysPerWeek)),
      progressionRules: toJson(fallback.progressionRules),
      regressionRules: toJson(fallback.regressionRules),
      isActive: true,
      isAiGenerated: false,
      createdAt: new Date(),
    };

    if (isDemoUser(session.user.id)) {
      const response = NextResponse.json({ plan: record });
      response.cookies.set(DEMO_WORKOUT_PLAN_COOKIE_NAME, encodeURIComponent(JSON.stringify(record)), {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
      return response;
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({ plan: record });
    }

    const existingActive = await db.query.workoutPlans.findFirst({
      where: and(eq(workoutPlans.userId, session.user.id), eq(workoutPlans.isActive, true)),
    });

    if (existingActive) {
      await db.update(workoutPlans).set({ isActive: false }).where(eq(workoutPlans.id, existingActive.id));
    }

    await db.insert(workoutPlans).values(record);
    return NextResponse.json({ plan: record });
  } catch (error) {
    return apiError(error, request);
  }
}
