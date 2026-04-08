import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { generateCoachFeedback } from "@/lib/ai/coach";
import { coachFeedbackInputSchema } from "@/lib/validation/schemas";
import { getAppProfile } from "@/lib/server/app-data";

export async function POST(request: Request) {
  try {
    const parsed = coachFeedbackInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid feedback payload", details: parsed.error.flatten() }, { status: 400 });
    }

    let profile = null;
    try {
      const session = await requireServerSession(request);
      profile = await getAppProfile(session.user.id);
    } catch {
      // Allow fallback feedback generation in demo mode without server auth.
      profile = null;
    }

    const feedback = await generateCoachFeedback({
      profile,
      ...parsed.data,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate feedback" }, { status: 500 });
  }
}
