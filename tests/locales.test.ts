import { describe, expect, it } from "vitest";
import { addLocaleHint, countryNameForLocale, LOCALE_OPTIONS } from "@/lib/locales";

describe("approximate locale hints", () => {
  it("offers the ISO country picker and resolves codes to country names", () => {
    expect(LOCALE_OPTIONS).toHaveLength(250);
    expect(LOCALE_OPTIONS.find((option) => option.code === "IN")?.name).toBe("India");
    expect(countryNameForLocale("en-US")).toBe("United States");
  });

  it("adds a plain-language country nudge and leaves global prompts unchanged", () => {
    expect(addLocaleHint("Compare local options.", "IN")).toBe("The user is located in India. Answer for that market, mentioning locally relevant options. Compare local options.");
    expect(addLocaleHint("Compare options.", "global")).toBe("Compare options.");
  });
});
