import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accountDeletionJobs } from "@/db/schema";
import { finishAccountDeletion } from "@/lib/server/account-deletion";
import { apiError } from "@/lib/server/api";
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ""}`);
  const actual = Buffer.from(request.headers.get("authorization") || "");
  if (!process.env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const jobs = await db.query.accountDeletionJobs.findMany({ where: eq(accountDeletionJobs.completed, false), limit: 25 });
    const results = await Promise.all(jobs.map(finishAccountDeletion));
    return NextResponse.json({ attempted: jobs.length, completed: results.filter(Boolean).length });
  } catch (error) { return apiError(error, request); }
}
