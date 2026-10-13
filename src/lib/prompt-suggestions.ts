export type SuggestionIntent = "discovery" | "alternatives" | "comparison" | "evaluation";
export type SuggestionTier = "core" | "expanded";
export type PromptSuggestion = { id: string; intent: SuggestionIntent; tier: SuggestionTier; topicName: string; text: string };

type SuggestionContext = {
  brand: string;
  industry: string | null;
  competitors: Array<{ id: string; name: string }>;
  existingPrompts: string[];
  year?: number;
};

const templates = [
  { id: "category-tools", intent: "discovery", tier: "core", topicName: "Buying questions", needsIndustry: true, text: "What are the best {industry} tools for {year}?" },
  { id: "choose-category", intent: "discovery", tier: "expanded", topicName: "Buying questions", needsIndustry: true, text: "What should a team consider when choosing {industry} software?" },
  { id: "alternatives", intent: "alternatives", tier: "core", topicName: "Alternatives", needsIndustry: false, text: "What are the best alternatives to {brand}?" },
  { id: "compare", intent: "comparison", tier: "core", topicName: "Comparisons", needsIndustry: false, needsCompetitor: true, text: "How does {brand} compare with {competitor}?" },
  { id: "best-fit", intent: "evaluation", tier: "expanded", topicName: "Evaluation", needsIndustry: false, text: "Is {brand} a good fit for a growing team in {year}?" },
] as const;

function normalize(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function generatePromptSuggestions(context: SuggestionContext): PromptSuggestion[] {
  const industry = context.industry?.trim();
  const year = String(context.year ?? new Date().getUTCFullYear());
  const existing = new Set(context.existingPrompts.map(normalize));
  const seen = new Set(existing);
  const suggestions: PromptSuggestion[] = [];

  for (const template of templates) {
    if (template.needsIndustry && !industry) continue;
    if ("needsCompetitor" in template && template.needsCompetitor) {
      for (const competitor of context.competitors) {
        const text = template.text.replaceAll("{brand}", context.brand).replaceAll("{competitor}", competitor.name).replaceAll("{industry}", industry ?? "").replaceAll("{year}", year);
        const normalized = normalize(text);
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        suggestions.push({ id: `${template.id}-${competitor.id}`, intent: template.intent, tier: template.tier, topicName: template.topicName, text });
      }
      continue;
    }
    const text = template.text.replaceAll("{brand}", context.brand).replaceAll("{competitor}", "").replaceAll("{industry}", industry ?? "").replaceAll("{year}", year);
    const normalized = normalize(text);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    suggestions.push({ id: template.id, intent: template.intent, tier: template.tier, topicName: template.topicName, text });
  }
  return suggestions;
}
