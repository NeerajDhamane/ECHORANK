import { describe, expect, it } from "vitest";
import { detectBrands } from "@/lib/analysis/mentions";

describe("detectBrands", () => {
  it("orders each detected brand by its first mention", () => {
    const hits = detectBrands("Try Monday.com or Asana", [
      { id: "asana", name: "Asana" },
      { id: "monday", name: "Monday.com" },
    ]);
    expect(hits).toEqual([
      { brandId: "monday", name: "Monday.com", position: 1 },
      { brandId: "asana", name: "Asana", position: 2 },
    ]);
  });

  it("matches names and aliases case-insensitively but returns one hit per brand", () => {
    const hits = detectBrands("ACME Studio is also called Acme Co. ACME.", [
      { id: "acme", name: "Acme Studio", aliases: ["Acme Co", "ACME"] },
    ]);
    expect(hits).toEqual([{ brandId: "acme", name: "Acme Studio", position: 1 }]);
  });

  it("does not match a name embedded in a larger word and omits absent brands", () => {
    expect(detectBrands("AsanaPro is mentioned, but not the standalone name.", [
      { id: "asana", name: "Asana" },
      { id: "monday", name: "Monday.com" },
    ])).toEqual([]);
  });

  it("matches punctuation-adjacent names and safely escapes regex punctuation", () => {
    expect(detectBrands("(Asana) is compatible with C++!", [
      { id: "cpp", name: "C++" },
      { id: "asana", name: "Asana" },
    ])).toEqual([
      { brandId: "asana", name: "Asana", position: 1 },
      { brandId: "cpp", name: "C++", position: 2 },
    ]);
  });

  it("uses the earliest match across aliases when assigning rank", () => {
    expect(detectBrands("Rival appears first; Acme later.", [
      { id: "acme", name: "Acme", aliases: ["Rival"] },
      { id: "rival", name: "Rival" },
    ])).toEqual([
      { brandId: "acme", name: "Acme", position: 1 },
      { brandId: "rival", name: "Rival", position: 2 },
    ]);
  });
});
