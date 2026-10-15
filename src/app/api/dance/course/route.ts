import { apiError, readJson } from "@/lib/server/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { loadPrimaryDanceRoutinePack } from "@/lib/dance/routine-pack";
import { buildHipHopTutorial } from "@/lib/dance/training-engine";
import { getDanceCourseState, recordDanceCourseAttempt } from "@/lib/server/dance-course";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";

const attemptSchema = z.object({
  routineId: z.string().min(1).max(160),
  segmentId: z.string().min(1).max(160),
  mode: z.enum(["guided_practice", "full_routine", "manual"]).default("manual"),
  score: z.number().min(0).max(100),
  reliability: z.number().min(0).max(100),
  timingScore: z.number().min(0).max(100).default(0),
  transitionScore: z.number().min(0).max(100).default(0),
  durationSeconds: z.number().int().min(0).max(7200).default(0),
  notes: z.string().max(500).optional(),
});

async function loadRoutineWithTutorial() {
  const routine = await loadPrimaryDanceRoutinePack();
  return { ...routine, tutorial: routine.tutorial?.length ? routine.tutorial : buildHipHopTutorial(routine) };
}

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const routine = await loadRoutineWithTutorial();
    const course = await getDanceCourseState(session.user.id, routine, { demo: isDemoUser(session.user.id) });
    return NextResponse.json({ routine, course });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "dance-course",
      key: session.user.id,
      limit: 30,
      windowMs: 60_000,
    });
    if (guard) return guard;

    const parsed = attemptSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid dance attempt payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const routine = await loadRoutineWithTutorial();
    if (isDemoUser(session.user.id)) {
      const course = await getDanceCourseState(session.user.id, routine, { demo: true });
      return NextResponse.json({ message: "Dance attempt recorded (demo mode)", result: null, course });
    }

    const result = await recordDanceCourseAttempt(session.user.id, parsed.data);
    const course = await getDanceCourseState(session.user.id, routine);
    return NextResponse.json({ message: "Dance attempt recorded", result, course });
  } catch (error) {
    return apiError(error, request);
  }
}
