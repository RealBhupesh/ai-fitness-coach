import { apiError, readJson } from "@/lib/server/api";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { foodLog } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { foodLogInputSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (!isDatabaseConfigured) {
      return NextResponse.json({ entries: [] });
    }
    const entries = await db.query.foodLog.findMany({
      where: eq(foodLog.userId, session.user.id),
      orderBy: [desc(foodLog.date)],
      limit: 100,
    });
    return NextResponse.json({ entries });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "nutrition-log",
      key: session.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = foodLogInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid food log payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const entry = {
      id: nanoid(),
      userId: session.user.id,
      date: new Date(),
      mealType: parsed.data.mealType,
      foodName: parsed.data.foodName,
      calories: parsed.data.calories,
      protein: parsed.data.protein,
      carbs: parsed.data.carbs,
      fat: parsed.data.fat,
      portion: parsed.data.portion,
      notes: parsed.data.notes,
      createdAt: new Date(),
    };
    if (!isDatabaseConfigured) {
      return NextResponse.json({ entry });
    }
    await db.insert(foodLog).values(entry);

    return NextResponse.json({ entry });
  } catch (error) {
    return apiError(error, request);
  }
}
