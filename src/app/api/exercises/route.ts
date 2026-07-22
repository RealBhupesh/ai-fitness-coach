import { NextRequest, NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { exercises, danceStyles } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// GET exercises
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");
    const type = searchParams.get("type"); // 'exercise' or 'dance'

    if (!isDatabaseConfigured) {
      if (type === "dance") {
        return NextResponse.json({
          danceStyles: [
            {
              id: "demo-hip-hop",
              name: "Hip-Hop Starter Groove",
              description: "Beginner-friendly routine focused on bounce, timing, and arm lines.",
              difficulty: "beginner",
              isActive: true,
            },
            {
              id: "demo-bollywood",
              name: "Bollywood Energy Basics",
              description: "Expressive hand shapes and footwork for demo practice.",
              difficulty: "beginner",
              isActive: true,
            },
          ],
        });
      }

      return NextResponse.json({
        exercises: [
          {
            id: "demo-bicep-curl",
            name: "Bicep Curl",
            category: "strength",
            difficulty: difficulty ?? "beginner",
            instructions: "Stand tall, keep elbows close, curl smoothly, and lower with control.",
            isActive: true,
          },
          {
            id: "demo-squat",
            name: "Bodyweight Squat",
            category: "strength",
            difficulty: difficulty ?? "beginner",
            instructions: "Keep chest tall, sit hips back, and track knees over toes.",
            isActive: true,
          },
        ].filter((exercise) => !category || exercise.category === category),
      });
    }

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
