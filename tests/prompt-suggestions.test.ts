import { describe, expect, it } from "vitest";
import { generatePromptSuggestions } from "@/lib/prompt-suggestions";

describe("prompt suggestions", () => {
  it("fills templates and excludes suggestions that duplicate existing prompts", () => {
    const suggestions = generatePromptSuggestions({
      brand: "Acme", industry: "Software", competitors: [{ id: "rival-id", name: "Rival" }],
      existingPrompts: ["WHAT are the best software tools for 2026??"], year: 2026,
    });
    const texts = suggestions.map(({ text }) => text);
    expect(texts).not.toContain("What are the best Software tools for 2026?");
    expect(texts).toContain("What are the best alternatives to Acme?");
    expect(texts).toContain("How does Acme compare with Rival?");
    expect(texts.every((text) => !/\{(?:industry|year|brand|competitor)\}/.test(text))).toBe(true);
    expect(new Set(texts.map((text) => text.toLowerCase())).size).toBe(texts.length);
  });

  it("does not invent an industry when the workspace has no industry value", () => {
    const suggestions = generatePromptSuggestions({ brand: "Acme", industry: null, competitors: [], existingPrompts: [], year: 2026 });
    expect(suggestions.every(({ text }) => !text.includes("industry"))).toBe(true);
    expect(suggestions.map(({ intent }) => intent)).toEqual(["alternatives", "evaluation"]);
  });
});
