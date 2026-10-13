import type { DiscoveryHit } from "./types";

const STOPWORDS = new Set(["what", "is", "the", "best", "for", "a", "an", "in", "to", "of", "and", "how", "which", "are", "do", "i", "my", "with", "on"]);

export function toQuery(prompt: string): string {
  return prompt.toLocaleLowerCase().replace(/[^a-z0-9\s]/gu, " ").split(/\s+/u).filter((word) => word && !STOPWORDS.has(word)).slice(0, 6).join(" ");
}

function normalizedLog(value: number, maximum: number): number {
  const positive = Math.max(0, Number.isFinite(value) ? value : 0);
  return maximum > 0 ? Math.log1p(positive) / Math.log1p(maximum) : 0;
}

export function rankHits(hits: DiscoveryHit[], competitorNames: string[], now = Date.now()) {
  const maxComments = Math.max(0, ...hits.map((hit) => hit.comments));
  const maxScore = Math.max(0, ...hits.map((hit) => hit.score));
  const rivals = competitorNames.filter(Boolean).map((name) => name.toLocaleLowerCase());
  return hits.map((hit) => {
    const created = hit.createdAt ? Date.parse(hit.createdAt) : Number.NaN;
    const ageDays = Number.isFinite(created) ? Math.max(0, (now - created) / 86_400_000) : 3650;
    const recency = Math.exp(-ageDays / 365);
    const base = 0.5 * normalizedLog(hit.comments, maxComments) + 0.3 * normalizedLog(hit.score, maxScore) + 0.2 * recency;
    const text = `${hit.title} ${hit.text ?? ""}`.toLocaleLowerCase();
    const competitor = rivals.find((name) => text.includes(name));
    return { ...hit, relevance: base * (competitor ? 1.25 : 1), ...(competitor ? { matchedCompetitor: competitorNames[rivals.indexOf(competitor)] } : {}) };
  }).sort((a, b) => b.relevance - a.relevance || a.title.localeCompare(b.title));
}
