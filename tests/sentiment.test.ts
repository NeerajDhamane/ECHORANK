import { describe, expect, it } from "vitest";
import { scoreSentiment } from "@/lib/analysis/sentiment";

describe("scoreSentiment", () => {
  it("flips a positive word when negated", () => {
    expect(scoreSentiment("Acme is not reliable", 0)?.label).toBe("negative");
  });

  it("scores positive language around a mention", () => {
    expect(scoreSentiment("Acme is a top, trusted choice", 0)?.label).toBe("positive");
  });

  it("returns neutral when no lexicon terms are present", () => {
    expect(scoreSentiment("Acme is available in several regions", 0)).toEqual({ label: "neutral", score: 0 });
  });

  it("returns null when the caller has no valid mention", () => {
    expect(scoreSentiment("No brand here", null)).toBeNull();
    expect(scoreSentiment("Acme is great", 99)).toBeNull();
  });

  it("limits scoring to the specified mention window", () => {
    const text = `terrible ${" ".repeat(200)}Acme is useful`;
    expect(scoreSentiment(text, text.indexOf("Acme"))?.label).toBe("positive");
  });
});
