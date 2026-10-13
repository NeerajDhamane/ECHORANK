import { providerConfig } from "@/lib/config";
import { ProviderHttpError, type AIProvider } from "./types";
import { addLocaleHint } from "@/lib/locales";

type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

export function createGeminiProvider(apiKey: string, model = providerConfig.gemini.model): AIProvider {
  return {
    id: "gemini",
    label: `Gemini (${model})`,
    isMock: false,
    async run(prompt, opts = {}) {
      const endpoint = `${providerConfig.gemini.endpoint}/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: addLocaleHint(prompt, opts.locale) }] }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new ProviderHttpError(`Gemini request failed with status ${response.status}`, response.status);
      const data = await response.json() as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!content) throw new Error("Gemini response did not include message text");
      return content;
    },
  };
}
