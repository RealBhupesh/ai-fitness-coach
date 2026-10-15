import { clerkClient } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accountDeletionJobs } from "@/db/schema";
import { reportEvent } from "@/lib/server/observability";
export async function finishAccountDeletion(job: typeof accountDeletionJobs.$inferSelect) {
  if (job.completed) return true;
  await db.update(accountDeletionJobs).set({ attempts: sql`${accountDeletionJobs.attempts} + 1` }).where(eq(accountDeletionJobs.id, job.id));
  try {
    if (job.provider === "clerk") {
      try { await (await clerkClient()).users.deleteUser(job.subject); }
      catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
    }
    await db.update(accountDeletionJobs).set({ completed: true }).where(eq(accountDeletionJobs.id, job.id));
    reportEvent("account_deletion", { pending: false });
    return true;
  } catch { reportEvent("account_deletion", { pending: true }); return false; }
}
