import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { foodLog } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { foodLogInputSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const entries = await db.query.foodLog.findMany({
      where: eq(foodLog.userId, session.user.id),
      orderBy: [desc(foodLog.date)],
      limit: 100,
    });
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const parsed = foodLogInputSchema.safeParse(await request.json());
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
    await db.insert(foodLog).values(entry);

    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
