export type SentimentLabel = "positive" | "negative" | "neutral";

export type SentimentResult = {
  label: SentimentLabel;
  score: number;
};

const POSITIVE_WORDS = new Set([
  "amazing", "best", "excellent", "fantastic", "great", "helpful", "reliable",
  "recommend", "top", "trusted", "useful", "wonderful",
]);

const NEGATIVE_WORDS = new Set([
  "awful", "bad", "broken", "disappointing", "poor", "terrible", "unreliable",
  "useless", "worst", "fails", "failure", "slow",
]);

const NEGATIONS = new Set([
  "not", "no", "never", "hardly", "without", "cannot", "can't", "isn't", "aren't",
  "wasn't", "weren't", "doesn't", "don't", "didn't", "won't", "wouldn't", "shouldn't",
  "couldn't", "mustn't", "hasn't", "haven't", "hadn't",
]);

const CLAUSE_BREAKS = new Set(["but", "however", "yet", "although", "though"]);
const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;

/** Score sentiment in a bounded window around a detected mention. Null means no valid mention. */
export function scoreSentiment(text: string, mentionIndex: number | null): SentimentResult | null {
  if (mentionIndex === null || !Number.isInteger(mentionIndex) || mentionIndex < 0 || mentionIndex >= text.length) {
    return null;
  }

  const windowStart = Math.max(0, mentionIndex - 160);
  const windowEnd = Math.min(text.length, mentionIndex + 260);
  const tokens = [...text.slice(windowStart, windowEnd).matchAll(TOKEN_PATTERN)];
  let total = 0;
  let count = 0;

  tokens.forEach((match, index) => {
    const word = match[0].toLocaleLowerCase("en");
    let polarity = POSITIVE_WORDS.has(word) ? 1 : NEGATIVE_WORDS.has(word) ? -1 : 0;
    if (polarity === 0) return;

    const previous = tokens.slice(Math.max(0, index - 3), index).map((token) => token[0].toLocaleLowerCase("en"));
    let negated = false;
    for (let offset = previous.length - 1; offset >= 0; offset -= 1) {
      const token = previous[offset];
      if (CLAUSE_BREAKS.has(token)) break;
      if (NEGATIONS.has(token)) {
        negated = true;
        break;
      }
    }
    if (negated) polarity *= -1;
    total += polarity;
    count += 1;
  });

  const score = count === 0 ? 0 : Math.max(-1, Math.min(1, total / count));
  const label: SentimentLabel = score >= 0.15 ? "positive" : score <= -0.15 ? "negative" : "neutral";
  return { label, score };
}
