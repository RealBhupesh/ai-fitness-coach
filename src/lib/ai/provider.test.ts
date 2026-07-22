import { describe, expect, it } from "vitest";
import { getAiProviderStatus, resolveAiProviderConfig, sanitizeAiError } from "@/lib/ai/provider";

describe("AI provider config", () => {
  it("prefers Groq when both providers are configured", () => {
    expect(
      resolveAiProviderConfig({
        GROQ_API_KEY: "groq-key",
        GROQ_MODEL: "groq-model",
        OPENAI_API_KEY: "openai-key",
        OPENAI_MODEL: "openai-model",
      }),
    ).toMatchObject({
      provider: "groq",
      model: "groq-model",
      baseURL: "https://api.groq.com/openai/v1",
    });
  });

  it("falls back to OpenAI when Groq is not configured", () => {
    expect(
      resolveAiProviderConfig({
        OPENAI_API_KEY: "openai-key",
        OPENAI_MODEL: "gpt-test",
      }),
    ).toMatchObject({
      provider: "openai",
      model: "gpt-test",
    });
  });

  it("reports fallback status without exposing keys", () => {
    expect(getAiProviderStatus({})).toEqual({
      configured: false,
      activeProvider: "fallback",
      activeModel: "fallback",
      groqConfigured: false,
      openaiConfigured: false,
      groqModel: "openai/gpt-oss-20b",
      openaiModel: "gpt-4o-mini",
    });
  });

  it("redacts likely API key content from errors", () => {
    expect(sanitizeAiError(new Error("bad api_key: sk-test-secret"))).toContain("[redacted]");
    expect(sanitizeAiError(new Error("Bearer gsk_secret_token failed"))).toContain("Bearer [redacted]");
  });
});
