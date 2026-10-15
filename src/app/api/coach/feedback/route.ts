import { apiError, readJson } from "@/lib/server/api";
import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { generateCoachFeedback } from "@/lib/ai/coach";
import { coachFeedbackInputSchema } from "@/lib/validation/schemas";
import { getAppProfile } from "@/lib/server/app-data";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "coach-feedback",
      key: session.user.id,
      limit: 30,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = coachFeedbackInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid feedback payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await getAppProfile(session.user.id);
    const feedback = await generateCoachFeedback({
      signal: request.signal,
      profile,
      ...parsed.data,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    return apiError(error, request);
  }
}
