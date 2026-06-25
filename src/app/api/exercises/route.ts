import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { exercises, danceStyles } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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

    const filters = [eq(exercises.isActive, true)];
    if (category) {
      filters.push(eq(exercises.category, category));
    }

    if (difficulty) {
      filters.push(eq(exercises.difficulty, difficulty));
    }

    const rows = await db.query.exercises.findMany({
      where: and(...filters),
    });

    return NextResponse.json({ exercises: rows });
  } catch (error) {
    console.error("Exercises API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exercises" },
      { status: 500 }
    );
  }
}
