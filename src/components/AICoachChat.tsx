"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, CircleGauge, Copy, Loader2, Send, Sparkles, TrendingUp, Utensils, Dumbbell, Music2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

const quickPrompts = [
  { icon: Dumbbell, label: "Plan today’s workout", prompt: "Plan today’s workout based on my saved profile and recent progress." },
  { icon: Utensils, label: "Adjust my meals", prompt: "Adjust today’s meals so I stay aligned with my current goal and training load." },
  { icon: Music2, label: "Dance practice cue", prompt: "Give me a short dance practice structure with posture and timing cues." },
  { icon: TrendingUp, label: "Review my progress", prompt: "Review my recent progress and tell me what to focus on next week." },
];

export function AICoachChat({ className }: { className?: string }) {
  const { profile } = useUserProfile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/chat", { credentials: "include" });
        const data = await response.json();
        if (!cancelled) {
          setMessages(data.messages ?? []);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    const message = content.trim();
    if (!message || isLoading) return;

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      const assistantText = response.ok
        ? (data.message ?? "I could not generate a reply right now.")
        : (data.error ? `Coach error: ${data.error}` : "I could not generate a reply right now.");
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "The coach could not respond right now. Please try again in a moment.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = async (message: Message) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (isLoadingHistory) {
    return (
      <Card className={cn("flex items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading chat history...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-primary/30 bg-primary/10 p-2">
            <CircleGauge className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-black uppercase tracking-[0.12em]">FitCoach AI</h2>
            <p className="text-xs text-muted-foreground">
              {profile?.name ? `Profile-aware coaching for ${profile.name}` : "Coaching becomes more personalized after onboarding."}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Start with a strong prompt</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Ask for a workout, meal plan adjustment, progress review, or technique help. The coach will use your saved profile and recent session data.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-6 max-w-xl mx-auto">
                {quickPrompts.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start h-auto py-3"
                      onClick={() => void sendMessage(item.prompt)}
                    >
                      <Icon className="h-4 w-4 mr-2 text-primary" />
                      <span className="truncate">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
              {message.role !== "user" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              ) : null}
              <div
                className={cn(
                  "group relative max-w-[80%] rounded-2xl px-4 py-3",
                  message.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md",
                )}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-xs opacity-60">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {message.role === "assistant" ? (
                    <button className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => void copyMessage(message)}>
                      {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  ) : null}
                </div>
              </div>
              {message.role === "user" ? (
                <div className="shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              ) : null}
            </div>
          ))}

          {isLoading ? (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          ) : null}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form
        className="border-t p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(input);
        }}
      >
        <div className="flex gap-2">
          <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask your coach anything..." />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The coach gives training guidance, not medical diagnosis. Mention pain or injuries so it can bias toward safer options.
        </p>
      </form>
    </Card>
  );
}
