import { providerConfig } from "@/lib/config";
import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";
import { createMockProvider, MOCK_PLATFORMS } from "./mock";
import type { AIProvider } from "./types";

type ProviderEnvironment = {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_MODEL?: string;
  GEMINI_MODEL?: string;
};

/** Always provide simulated platforms; add real providers only when their keys are configured. */
export function getProviders(env: ProviderEnvironment = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
}): AIProvider[] {
  const providers: AIProvider[] = MOCK_PLATFORMS.map(({ id, label }) => createMockProvider(id, label));
  const groqKey = env.GROQ_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (groqKey) providers.push(createGroqProvider(groqKey, env.GROQ_MODEL?.trim() || providerConfig.groq.model));
  if (geminiKey) providers.push(createGeminiProvider(geminiKey, env.GEMINI_MODEL?.trim() || providerConfig.gemini.model));
  return providers;
}
