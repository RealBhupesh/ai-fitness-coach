import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { generateCoachMessage } from "@/lib/ai/coach";
import { chatInputSchema } from "@/lib/validation/schemas";
import { ensureChatSession, getAppProfile } from "@/lib/server/app-data";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { toJson } from "@/lib/utils/json";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json({ messages: [] });
    }
    const messages = await db.query.chatMessages.findMany({
      where: eq(chatMessages.userId, session.user.id),
      orderBy: [desc(chatMessages.createdAt)],
      limit: 50,
    });

    return NextResponse.json({ messages: messages.reverse() });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = guardMutationRequest(request, {
      bucket: "chat",
      key: `${session.user.id}:${getRequestIp(request)}`,
      limit: 24,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = chatInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid chat payload", details: parsed.error.flatten() }, { status: 400 });
    }

    if (isDemoUser(session.user.id)) {
      const generated = await generateCoachMessage({
        profile: null,
        recentMessages: [],
        sessionSummary: "Demo chat session",
        sessionContext: "Demo mode (no persistence)",
        userMessage: parsed.data.message,
      });

      return NextResponse.json({
        message: generated.message,
        tokens: generated.tokens,
        provider: generated.provider,
      });
    }

    const currentChatSession = await ensureChatSession(session.user.id);
    const [profile, recentMessages] = await Promise.all([
      getAppProfile(session.user.id),
      db.query.chatMessages.findMany({
        where: eq(chatMessages.userId, session.user.id),
        orderBy: [desc(chatMessages.createdAt)],
        limit: 10,
      }),
    ]);

    const generated = await generateCoachMessage({
      profile,
      recentMessages: recentMessages.reverse().map((message) => ({
        role: message.role as "system" | "user" | "assistant",
        content: message.content,
      })),
      sessionSummary: currentChatSession.summary ?? undefined,
      sessionContext: currentChatSession.context ?? undefined,
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
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to process chat request" }, { status });
  }
}
