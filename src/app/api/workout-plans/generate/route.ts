import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workoutPlans } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { buildFallbackWorkoutPlan, getAppProfile } from "@/lib/server/app-data";
import { toJson } from "@/lib/utils/json";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const profile = await getAppProfile(session.user.id);
    const generated = buildFallbackWorkoutPlan(profile);

    const existingActive = await db.query.workoutPlans.findFirst({
      where: and(eq(workoutPlans.userId, session.user.id), eq(workoutPlans.isActive, true)),
    });

    if (existingActive) {
      await db.update(workoutPlans).set({ isActive: false }).where(eq(workoutPlans.id, existingActive.id));
    }

    const plan = {
      id: nanoid(),
      userId: session.user.id,
      name: generated.name,
      description: generated.description,
      goal: generated.goal,
      duration: generated.duration,
      daysPerWeek: generated.daysPerWeek,
      difficulty: generated.difficulty,
      weeklySchedule: toJson(generated.weeklySchedule),
      progressionRules: toJson(generated.progressionRules),
      regressionRules: toJson(generated.regressionRules),
      isActive: true,
      isAiGenerated: true,
      createdAt: new Date(),
    };

    await db.insert(workoutPlans).values(plan);
    return NextResponse.json({ plan: generated, record: plan });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
