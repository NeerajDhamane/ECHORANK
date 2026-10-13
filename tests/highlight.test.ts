import { describe, expect, it } from "vitest";
import { highlightText } from "@/lib/highlight";

describe("chat answer highlighting", () => {
  it("marks own brand amber, rivals muted, and leaves markup as ordinary text", () => {
    const answer = '<script>alert("Acme")</script> ACME works with RivalCo and AcmeCloud.';
    const segments = highlightText(answer, [
      { id: "own", name: "Acme", aliases: ["ACME"] },
      { id: "rival", name: "RivalCo" },
    ], "own");
    expect(segments.filter((part) => part.brandId).map(({ text, brandId, isOwnBrand }) => ({ text, brandId, isOwnBrand }))).toEqual([
      { text: "Acme", brandId: "own", isOwnBrand: true },
      { text: "ACME", brandId: "own", isOwnBrand: true },
      { text: "RivalCo", brandId: "rival", isOwnBrand: false },
    ]);
    expect(segments.map(({ text }) => text).join("")).toBe(answer);
    expect(segments[0]?.text).toBe('<script>alert("');
    expect(segments.at(-1)?.text).toBe(" and AcmeCloud.");
  });
});
