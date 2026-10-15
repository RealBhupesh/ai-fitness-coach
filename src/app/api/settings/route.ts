import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { apiError, readJson, ApiError } from "@/lib/server/api";
import { guardMutationRequest } from "@/lib/security/request-guard";
const schema = z.object({ units: z.enum(["metric", "imperial"]).optional(), theme: z.enum(["light", "dark", "system"]).optional() }).refine(value => value.units !== undefined || value.theme !== undefined);
export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const settings = isDemoUser(session.user.id) ? null : await db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.user.id) });
    return NextResponse.json({ settings: settings ?? { units: "metric", theme: "system" }, remindersAvailable: false });
  } catch (error) { return apiError(error, request); }
}
export async function PUT(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, { bucket: "settings", key: session.user.id, limit: 20, windowMs: 60000 });
    if (guard) return guard;
    const result = schema.safeParse(await readJson(request, 4096));
    if (!result.success) throw new ApiError(400, "INVALID_SETTINGS", "Invalid settings");
    if (isDemoUser(session.user.id)) return NextResponse.json({ settings: result.data, demo: true });
    const [settings] = await db.insert(userSettings).values({ userId: session.user.id, units: "metric", theme: "system", ...result.data }).onConflictDoUpdate({ target: userSettings.userId, set: { ...result.data, updatedAt: new Date() } }).returning();
    return NextResponse.json({ settings });
  } catch (error) { return apiError(error, request); }
}
