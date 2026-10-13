export const providerConfig = {
  groq: {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },
} as const;
