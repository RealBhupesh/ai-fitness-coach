import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { exercises, danceStyles } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";

// GET exercises
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");
    const type = searchParams.get("type"); // 'exercise' or 'dance'

    if (type === "dance") {
      // Get dance styles
      const styles = await db.query.danceStyles.findMany({
        where: eq(danceStyles.isActive, true),
      });
      return NextResponse.json({ danceStyles: styles });
    }

    // Get exercises
    let query = db.select().from(exercises).where(eq(exercises.isActive, true));

    // Apply filters (simplified - in production use Drizzle query builder properly)
    const allExercises = await db.query.exercises.findMany({
      where: eq(exercises.isActive, true),
    });

    let filtered = allExercises;

    if (category) {
      filtered = filtered.filter((ex) => ex.category === category);
    }

    if (difficulty) {
      filtered = filtered.filter((ex) => ex.difficulty === difficulty);
    }

    return NextResponse.json({ exercises: filtered });
  } catch (error: any) {
    console.error("Exercises API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exercises" },
      { status: 500 }
    );
  }
}
