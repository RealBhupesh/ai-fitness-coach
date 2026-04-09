import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workoutPlans } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { workoutPlanCreateSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils/json";
import { buildFallbackWorkoutPlan } from "@/lib/server/app-data";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const plans = await db.query.workoutPlans.findMany({
      where: eq(workoutPlans.userId, session.user.id),
      orderBy: [desc(workoutPlans.createdAt)],
    });

    return NextResponse.json({ plans });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "workout-plans",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 12,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = workoutPlanCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const existingActive = await db.query.workoutPlans.findFirst({
      where: and(eq(workoutPlans.userId, session.user.id), eq(workoutPlans.isActive, true)),
    });

    if (existingActive) {
      await db.update(workoutPlans).set({ isActive: false }).where(eq(workoutPlans.id, existingActive.id));
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

    await db.insert(workoutPlans).values(record);
    return NextResponse.json({ plan: record });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
