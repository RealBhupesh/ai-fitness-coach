export type AiProviderName = "groq" | "openai";
export type AiProviderStatusName = AiProviderName | "fallback";

export type AiProviderConfig = {
  provider: AiProviderName;
  model: string;
  baseURL?: string;
};

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

type AiEnv = Record<string, string | undefined>;

export function resolveAiProviderConfig(env: AiEnv = process.env): AiProviderConfig | null {
  if (env.GROQ_API_KEY?.trim()) {
    return {
      provider: "groq",
      model: env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
      baseURL: GROQ_BASE_URL,
    };
  }

  if (env.OPENAI_API_KEY?.trim()) {
    return {
      provider: "openai",
      model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    };
  }

  return null;
}

export function getAiProviderStatus(env: AiEnv = process.env) {
  const active = resolveAiProviderConfig(env);

  return {
    configured: Boolean(active),
    activeProvider: active?.provider ?? ("fallback" as const),
    activeModel: active?.model ?? "fallback",
    groqConfigured: Boolean(env.GROQ_API_KEY?.trim()),
    openaiConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    groqModel: env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
    openaiModel: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
  };
}

export function sanitizeAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key['":=\s]+)[A-Za-z0-9._-]+/gi, "$1[redacted]")
    .slice(0, 240);
}
