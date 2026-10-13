export type ContentFeatures = {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLen: number;
  questionCount: number;
  faqPairs: number;
  headingCount: number;
  bulletCount: number;
  numericRatio: number;
  fleschReadingEase: number;
  hasSchemaJsonLd: boolean;
  entityDensity: number;
  passiveRatio: number;
};

function syllables(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/gu, "");
  if (!normalized) return 0;
  const groups = normalized.replace(/e$/u, "").match(/[aeiouy]{1,2}/gu);
  return Math.max(1, groups?.length ?? 1);
}

function visibleText(raw: string): string {
  return raw.replace(/<script\b[\s\S]*?<\/script\s*>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/giu, " ")
    .replace(/<\/(?:p|h[1-6]|li|div|section|article|tr|blockquote)\s*>/giu, ". ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ").replace(/&amp;/giu, "&").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
    .replace(/&quot;|&#34;/giu, '"').replace(/&#39;|&apos;/giu, "'").replace(/\s+/gu, " ").trim();
}

/** Extract deterministic, explainable text and structure signals from pasted text or HTML. */
export function extractFeatures(raw: string): ContentFeatures {
  const hasSchemaJsonLd = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/iu.test(raw);
  const text = visibleText(raw);
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? [];
  const sentences = text.split(/(?<=[.!?])\s+/u).map((item) => item.trim()).filter((item) => item.length > 2);
  const questions = sentences.filter((item) => item.endsWith("?"));
  let faqPairs = 0;
  for (let index = 0; index < sentences.length - 1; index += 1) {
    if (sentences[index]?.endsWith("?") && !sentences[index + 1]?.endsWith("?")) faqPairs += 1;
  }
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = words.length;
  const averageSentenceLength = wordCount / sentenceCount;
  const syllableCount = words.reduce((sum, word) => sum + syllables(word), 0);
  const numericTokens = words.filter((word) => /\d/u.test(word)).length;
  const headings = (raw.match(/<h[1-6][\s>]|^#{1,6}\s/gimu) ?? []).length;
  const bullets = (raw.match(/<li[\s>]|^\s*[-*•]\s/gimu) ?? []).length;
  const entityCount = (text.match(/\b[A-Z][\p{L}'’-]*(?:\s+[A-Z][\p{L}'’-]*)*/gu) ?? []).length;
  const passiveCount = (text.match(/\b(?:is|are|was|were|been|being)\s+[\p{L}]+ed\b/giu) ?? []).length;
  return {
    wordCount,
    sentenceCount: sentences.length,
    avgSentenceLen: Number(averageSentenceLength.toFixed(1)),
    questionCount: questions.length,
    faqPairs,
    headingCount: headings,
    bulletCount: bullets,
    numericRatio: Number((numericTokens / Math.max(1, wordCount)).toFixed(3)),
    fleschReadingEase: Number((206.835 - 1.015 * averageSentenceLength - 84.6 * syllableCount / Math.max(1, wordCount)).toFixed(1)),
    hasSchemaJsonLd,
    entityDensity: Number((entityCount / sentenceCount).toFixed(2)),
    passiveRatio: Number((passiveCount / sentenceCount).toFixed(2)),
  };
}

export type ContentCheck = { ok: boolean; pts: number; label: string; fix: string };
export type ContentScore = { score: number; checks: ContentCheck[]; passed: ContentCheck[]; failed: ContentCheck[] };

export function scoreContent(features: ContentFeatures): ContentScore {
  const checks: ContentCheck[] = [
    { ok: features.faqPairs >= 3, pts: 20, label: "FAQ-style Q&A pairs (≥3)", fix: "Add a short FAQ section with 3–5 real buyer questions and direct answers." },
    { ok: features.fleschReadingEase >= 50, pts: 20, label: "Readable (Flesch ≥ 50)", fix: "Shorten sentences and replace jargon." },
    { ok: features.avgSentenceLen <= 22, pts: 10, label: "Sentences ≤ 22 words avg", fix: "Split long sentences." },
    { ok: features.numericRatio <= 0.06, pts: 10, label: "Not statistics-dense", fix: "Move dense number tables out of the main prose." },
    { ok: features.headingCount >= 3, pts: 10, label: "Clear headings (≥3)", fix: "Add descriptive H2/H3 headings." },
    { ok: features.bulletCount >= 3, pts: 5, label: "Bullet/list structure", fix: "Convert comparisons into bullet lists." },
    { ok: features.hasSchemaJsonLd, pts: 15, label: "schema.org JSON-LD present", fix: "Add Organization, Product, or FAQPage JSON-LD." },
    { ok: features.wordCount >= 300, pts: 5, label: "Enough substance (≥300 words)", fix: "Expand with specifics a buyer would need." },
    { ok: features.passiveRatio <= 0.25, pts: 5, label: "Mostly active voice", fix: "Rewrite passive sentences actively." },
  ];
  return { score: checks.reduce((sum, check) => sum + (check.ok ? check.pts : 0), 0), checks, passed: checks.filter((check) => check.ok), failed: checks.filter((check) => !check.ok) };
}
