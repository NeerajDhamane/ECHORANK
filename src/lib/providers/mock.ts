import type { AIProvider, ProviderOptions } from "./types";

const TEMPLATES = [
  "For this kind of question, compare independent reviews on trustpilot.com and discussions on reddit.com.",
  "Look at current documentation at docs.example.com and compare the available options for the stated needs.",
  "A practical shortlist should weigh reliability, support, and price; community discussions on reddit.com can add context.",
  "Compare the leading options against the requirements and verify details with each provider's official documentation.",
];

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function createMockProvider(id: string, label: string): AIProvider {
  return {
    id,
    label: `${label} (simulated)`,
    isMock: true,
    async run(prompt: string, opts: ProviderOptions = {}): Promise<string> {
      const date = opts.date ?? new Date().toISOString().slice(0, 10);
      const seed = hash(`${prompt}\u0000${label}\u0000${date}`);
      const template = TEMPLATES[seed % TEMPLATES.length];
      const brandName = opts.brandName?.trim();
      const includeBrand = Boolean(brandName) && seed % 4 !== 0;
      const locale = opts.locale ? ` [Locale hint: ${opts.locale}.]` : "";
      const brandSentence = includeBrand
        ? `${brandName} may be worth comparing for this request.`
        : "Several options may fit; compare them against the requirements in the question.";
      return `${brandSentence} ${template}${locale}`;
    },
  };
}

export const MOCK_PLATFORMS = [
  { id: "mock-chatgpt", label: "ChatGPT" },
  { id: "mock-perplexity", label: "Perplexity" },
  { id: "mock-google-ai", label: "Google AI" },
] as const;
