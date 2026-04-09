import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { generateCoachFeedback } from "@/lib/ai/coach";
import { coachFeedbackInputSchema } from "@/lib/validation/schemas";
import { getAppProfile } from "@/lib/server/app-data";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "coach-feedback",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = coachFeedbackInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid feedback payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await getAppProfile(session.user.id);
    const feedback = await generateCoachFeedback({
      profile,
      ...parsed.data,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to generate feedback" }, { status });
  }
}
