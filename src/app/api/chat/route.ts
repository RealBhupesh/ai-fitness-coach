import { apiError, readJson } from "@/lib/server/api";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { buildDemoProfile, getDemoNutritionPlanFromCookie, getDemoProfileFromCookie, getDemoWorkoutPlanFromCookie, isDemoUser } from "@/lib/dummy-auth";
import { generateCoachMessage } from "@/lib/ai/coach";
import { chatInputSchema } from "@/lib/validation/schemas";
import { ensureChatSession, getAppProfile, getDashboardSummary } from "@/lib/server/app-data";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { toJson } from "@/lib/utils/json";

function buildFitnessContext(input: {
  profileName?: string;
  recentSessions?: Array<{ type: string; exerciseType?: string | null; duration: number; compositeScore: number; date: string }>;
  activePlan?: { name: string; progress: number; currentWeek: number; daysPerWeek: number } | null;
  activeNutritionPlan?: { name: string; dailyCalories: number; proteinGrams: number; carbsGrams: number; fatGrams: number } | null;
}) {
  const recentSessionsText =
    input.recentSessions?.length
      ? input.recentSessions
          .slice(-3)
          .map((session) => `${session.type}${session.exerciseType ? `/${session.exerciseType}` : ""} for ${session.duration} min, score ${session.compositeScore}, date ${session.date.slice(0, 10)}`)
          .join("; ")
      : "No recent logged sessions.";

  return [
    `Athlete: ${input.profileName ?? "Unknown"}`,
    input.activePlan
      ? `Active workout plan: ${input.activePlan.name}, progress ${input.activePlan.progress}%, week ${input.activePlan.currentWeek}, ${input.activePlan.daysPerWeek} days/week.`
      : "Active workout plan: none.",
    input.activeNutritionPlan
      ? `Active nutrition plan: ${input.activeNutritionPlan.name}, ${input.activeNutritionPlan.dailyCalories} kcal, ${input.activeNutritionPlan.proteinGrams}g protein, ${input.activeNutritionPlan.carbsGrams}g carbs, ${input.activeNutritionPlan.fatGrams}g fat.`
      : "Active nutrition plan: none.",
    `Recent sessions: ${recentSessionsText}`,
  ].join("\n");
}

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json({ messages: [] });
    }
    if (!isDatabaseConfigured) {
      return NextResponse.json({ messages: [] });
    }
    const messages = await db.query.chatMessages.findMany({
      where: eq(chatMessages.userId, session.user.id),
      orderBy: [desc(chatMessages.createdAt)],
      limit: 50,
    });

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "chat",
      key: session.user.id,
      limit: 24,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = chatInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid chat payload", details: parsed.error.flatten() }, { status: 400 });
    }

    if (isDemoUser(session.user.id)) {
      const generated = await generateCoachMessage({
        signal: request.signal,
        profile: getDemoProfileFromCookie(request.headers.get("cookie") || "") ?? buildDemoProfile(),
        recentMessages: [],
        sessionSummary: "Demo chat session",
        sessionContext: buildFitnessContext({
          profileName: (getDemoProfileFromCookie(request.headers.get("cookie") || "") ?? buildDemoProfile()).name,
          activePlan: (() => {
            const plan = getDemoWorkoutPlanFromCookie<Record<string, any>>(request.headers.get("cookie") || "");
            return plan
              ? {
                  name: String(plan.name ?? "Demo workout plan"),
                  progress: 0,
                  currentWeek: 1,
                  daysPerWeek: Number(plan.daysPerWeek ?? 0),
                }
              : null;
          })(),
          activeNutritionPlan: (() => {
            const plan = getDemoNutritionPlanFromCookie<Record<string, any>>(request.headers.get("cookie") || "");
            return plan
              ? {
                  name: String(plan.name ?? "Demo nutrition plan"),
                  dailyCalories: Number(plan.dailyCalories ?? 0),
                  proteinGrams: Number(plan.proteinGrams ?? 0),
                  carbsGrams: Number(plan.carbsGrams ?? 0),
                  fatGrams: Number(plan.fatGrams ?? 0),
                }
              : null;
          })(),
          recentSessions: [],
        }),
        userMessage: parsed.data.message,
      });

      return NextResponse.json({
        message: generated.message,
        tokens: generated.tokens,
        provider: generated.provider,
        model: generated.model,
        attemptedProvider: generated.attemptedProvider,
        attemptedModel: generated.attemptedModel,
        providerError: generated.error,
      });
    }

    if (!isDatabaseConfigured) {
      const [profile, dashboard] = await Promise.all([
        getAppProfile(session.user.id),
        getDashboardSummary(session.user.id),
      ]);
      const generated = await generateCoachMessage({
        signal: request.signal,
        profile,
        recentMessages: [],
        sessionSummary: "Database-free demo chat session",
        sessionContext: buildFitnessContext({
          profileName: profile?.name,
          recentSessions: dashboard.recentSessions,
          activePlan: dashboard.activePlan,
          activeNutritionPlan: dashboard.activeNutritionPlan,
        }),
        userMessage: parsed.data.message,
      });

      return NextResponse.json({
        message: generated.message,
        tokens: generated.tokens,
        provider: generated.provider,
        model: generated.model,
        attemptedProvider: generated.attemptedProvider,
        attemptedModel: generated.attemptedModel,
        providerError: generated.error,
      });
    }

    const currentChatSession = await ensureChatSession(session.user.id);
    const [profile, dashboard, recentMessages] = await Promise.all([
      getAppProfile(session.user.id),
      getDashboardSummary(session.user.id),
      db.query.chatMessages.findMany({
        where: eq(chatMessages.userId, session.user.id),
        orderBy: [desc(chatMessages.createdAt)],
        limit: 10,
      }),
    ]);

    const generated = await generateCoachMessage({
        signal: request.signal,
      profile,
      recentMessages: recentMessages.reverse().map((message) => ({
        role: message.role as "system" | "user" | "assistant",
        content: message.content,
      })),
      sessionSummary: currentChatSession.summary ?? undefined,
      sessionContext: [currentChatSession.context ?? "", buildFitnessContext({
        profileName: profile?.name,
        recentSessions: dashboard.recentSessions,
        activePlan: dashboard.activePlan,
        activeNutritionPlan: dashboard.activeNutritionPlan,
      })].filter(Boolean).join("\n\n"),
      userMessage: parsed.data.message,
    });

    await db.insert(chatMessages).values([
      {
        id: nanoid(),
        userId: session.user.id,
        sessionId: currentChatSession.id,
        role: "user",
        content: parsed.data.message,
        createdAt: new Date(),
      },
      {
        id: nanoid(),
        userId: session.user.id,
        sessionId: currentChatSession.id,
        role: "assistant",
        content: generated.message,
        metadata: toJson({
          provider: generated.provider,
          model: generated.model,
          tokens: generated.tokens,
          attemptedProvider: generated.attemptedProvider,
          attemptedModel: generated.attemptedModel,
          providerError: generated.error,
        }),
        createdAt: new Date(),
      },
    ]);

    await db
      .update(chatSessions)
      .set({
        lastMessageAt: new Date(),
        summary: `Goal: ${profile?.goals[0] ?? "general fitness"}. Latest user request: ${parsed.data.message.slice(0, 220)}. Latest coach reply: ${generated.message.slice(0, 220)}.`,
        context: toJson({
          lastUserMessage: parsed.data.message,
          lastAssistantMessage: generated.message,
          focusGoal: profile?.goals[0] ?? null,
          coachingTone: profile?.coachingTone ?? null,
          updatedAt: new Date().toISOString(),
        }),
      })
      .where(eq(chatSessions.id, currentChatSession.id));

    return NextResponse.json({
      message: generated.message,
      tokens: generated.tokens,
      provider: generated.provider,
      model: generated.model,
      attemptedProvider: generated.attemptedProvider,
      attemptedModel: generated.attemptedModel,
      providerError: generated.error,
    });
  } catch (error) {
    return apiError(error, request);
  }
}
