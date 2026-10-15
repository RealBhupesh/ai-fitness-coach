import OpenAI from "openai";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { resolveAiProviderConfig, type AiProviderName } from "@/lib/ai/provider";
import { reportEvent } from "@/lib/server/observability";
import { consumeLimit } from "@/lib/security/request-guard";
import { ApiError } from "@/lib/server/api";
export type CompletionAttempt = { provider: AiProviderName; model: string; create: (params: ChatCompletionCreateParamsNonStreaming, signal: AbortSignal) => Promise<ChatCompletion> };
export async function completionWithFailover(params: ChatCompletionCreateParamsNonStreaming, candidates: CompletionAttempt[], options: { signal?: AbortSignal; validate?: (completion: ChatCompletion) => void; quota?: boolean } = {}) {
  const requestedTokens=params.max_completion_tokens ?? params.max_tokens ?? 1400;
  const outputLimit=Number.isFinite(requestedTokens) ? Math.max(1,Math.min(Math.floor(requestedTokens),1600)) : 1400;
  const cappedMessages=params.messages.map(m=>typeof m.content === "string" ? {...m,content:m.content.slice(0,12000)}:m);
  const boundedParams={...params,messages:cappedMessages,n:1,...(params.max_completion_tokens != null ? {max_completion_tokens:outputLimit,max_tokens:undefined} : {max_tokens:outputLimit})};
  const deadline = AbortSignal.timeout(14000);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  for (const [index, candidate] of candidates.entries()) {
    signal.throwIfAborted();
    if (options.quota !== false && process.env.NODE_ENV === "production") {
      let allowed = false;
      try { allowed = (await consumeLimit(`ai-attempts:${new Date().toISOString().slice(0,10)}`, 2000, 86400000)).allowed; } catch { throw new ApiError(503, "QUOTA_UNAVAILABLE", "AI usage limits temporarily unavailable"); }
      if (!allowed) throw new ApiError(429, "AI_BUDGET_REACHED", "Today's AI usage limit was reached. Local movement coaching remains available.");
    }
    if (options.quota !== false && process.env.NODE_ENV === "production") {
      const reserve=Buffer.byteLength(JSON.stringify(cappedMessages),"utf8")+256*cappedMessages.length+outputLimit;
      let allowed=false;
      try { const budget=Number(process.env.AI_DAILY_TOKEN_BUDGET || 200000); if(!Number.isInteger(budget)||budget<1)throw new Error(); allowed=(await consumeLimit(`ai-tokens:${new Date().toISOString().slice(0,10)}`,budget,86400000,reserve)).allowed; }
      catch { throw new ApiError(503,"QUOTA_UNAVAILABLE","AI usage limits temporarily unavailable"); }
      if(!allowed)throw new ApiError(429,"AI_BUDGET_REACHED","Today's AI usage limit was reached. Local movement coaching remains available.");
    }
    const started = Date.now();
    try {
      const completion = await candidate.create({ ...boundedParams, model: candidate.model }, signal);
      if (!completion.choices[0]?.message.content?.trim()) throw new Error("EMPTY_COMPLETION");
      options.validate?.(completion);
      reportEvent("ai_completion", { provider: candidate.provider, model: candidate.model, attempt: index + 1, latencyMs: Date.now()-started, tokens: completion.usage?.total_tokens ?? 0 });
      return { completion, provider: candidate.provider };
    } catch {
      reportEvent("ai_attempt_failed", { provider: candidate.provider, model: candidate.model, attempt: index + 1, latencyMs: Date.now()-started });
      if (options.signal?.aborted) options.signal.throwIfAborted();
    }
  }
  throw new Error("AI_PROVIDERS_UNAVAILABLE");
}
export function getFailoverClient(signal?: AbortSignal, validate?: (completion: ChatCompletion) => void) {
  const candidates: CompletionAttempt[] = [];
  const configs = [resolveAiProviderConfig(), resolveAiProviderConfig({ ...process.env, GROQ_API_KEY: undefined })];
  for (const config of configs) {
    if (!config || candidates.some(c => c.provider === config.provider)) continue;
    const client = new OpenAI({ apiKey: config.provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY, baseURL: config.baseURL, timeout: 6500, maxRetries: 0 });
    candidates.push({ ...config, create: (params, abort) => client.chat.completions.create(params, { signal: abort }) });
  }
  if (!candidates.length) return null;
  const result = {
    provider: candidates[0].provider,
    model: candidates[0].model,
    client: { chat: { completions: { create: async (params: ChatCompletionCreateParamsNonStreaming) => {
      const completed = await completionWithFailover(params, candidates, { signal, validate });
      result.provider = completed.provider;
      result.model = completed.completion.model;
      return completed.completion;
    } } } },
  };
  return result;
}
