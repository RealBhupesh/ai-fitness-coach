import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { desc, eq } from "drizzle-orm";
import { db, isDatabaseConfigured } from "@/db";
import { progressTracking } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { parseJsonObject, toJson } from "@/lib/utils/json";

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function recoveryPayload(body: Record<string, unknown>) {
  return {
    recoveryCheckIn: {
      sleepHours: clampNumber(body.sleepHours, 7, 0, 14),
      sleepQuality: clampNumber(body.sleepQuality, 3, 1, 5),
      soreness: clampNumber(body.soreness, 2, 1, 5),
      stress: clampNumber(body.stress, 2, 1, 5),
      energy: clampNumber(body.energy, 3, 1, 5),
      hydration: clampNumber(body.hydration, 3, 1, 5),
      mood: typeof body.mood === "string" ? body.mood.slice(0, 40) : "steady",
      notes: typeof body.notes === "string" ? body.notes.slice(0, 400) : "",
      loggedAt: new Date().toISOString(),
    },
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id) || !isDatabaseConfigured) {
      return NextResponse.json({
        recoveryCheckIn: {
          sleepHours: 7.3,
          sleepQuality: 4,
          soreness: 2,
          stress: 2,
          energy: 4,
          hydration: 3,
          mood: "focused",
          notes: "Demo recovery check-in.",
          loggedAt: new Date().toISOString(),
        },
      });
    }

    const rows = await db.query.progressTracking.findMany({
      where: eq(progressTracking.userId, session.user.id),
      orderBy: [desc(progressTracking.date)],
      limit: 12,
    });
    const latest = rows
      .map((row) => parseJsonObject<any>(row.notes, null)?.recoveryCheckIn)
      .find(Boolean);
    return NextResponse.json({ recoveryCheckIn: latest ?? null });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to load recovery check-in" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "recovery-checkin",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const body = await request.json().catch(() => ({}));
    const payload = recoveryPayload(body && typeof body === "object" ? body : {});

    if (isDemoUser(session.user.id) || !isDatabaseConfigured) {
      return NextResponse.json(payload);
    }

    await db.insert(progressTracking).values({
      id: nanoid(),
      userId: session.user.id,
      date: new Date(),
      adherence: Math.round(((payload.recoveryCheckIn.energy + payload.recoveryCheckIn.sleepQuality + payload.recoveryCheckIn.hydration) / 15) * 100),
      notes: toJson(payload),
    });

    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to save recovery check-in" }, { status });
  }
}
