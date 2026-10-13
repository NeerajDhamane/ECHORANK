import { providerConfig } from "@/lib/config";
import { ProviderHttpError, type AIProvider } from "./types";
import { addLocaleHint } from "@/lib/locales";

type GroqResponse = { choices?: Array<{ message?: { content?: string | null } }> };

export function createGroqProvider(apiKey: string, model = providerConfig.groq.model): AIProvider {
  return {
    id: "groq",
    label: `Groq (${model})`,
    isMock: false,
    async run(prompt, opts = {}) {
      const response = await fetch(providerConfig.groq.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: addLocaleHint(prompt, opts.locale) }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new ProviderHttpError(`Groq request failed with status ${response.status}`, response.status);
      const data = await response.json() as GroqResponse;
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Groq response did not include message text");
      return content;
    },
  };
}
