import { describe, expect, it } from "vitest";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";

describe("overview query scope", () => {
  it("defaults to the last 30 UTC dates with simulated answers excluded", () => {
    const query = overviewQuerySchema.parse({});
    expect(overviewScope("brand-a", query, new Date("2026-10-14T18:30:00.000Z"))).toEqual({
      brandId: "brand-a", dateFrom: "2026-09-15", dateTo: "2026-10-14", includeSimulated: false,
    });
  });

  it("maps custom dates and optional filters into the shared Scope", () => {
    const query = overviewQuerySchema.parse({
      range: "custom", from: "2026-10-01", to: "2026-10-14", platform: "ChatGPT",
      promptId: "prompt-a", tagId: "tag-a", locale: "en-US", includeSimulated: "true",
    });
    expect(overviewScope("brand-a", query)).toMatchObject({
      brandId: "brand-a", dateFrom: "2026-10-01", dateTo: "2026-10-14", platform: "ChatGPT",
      promptId: "prompt-a", tagId: "tag-a", locale: "en-US", includeSimulated: true,
    });
  });

  it("rejects invalid dates, reversed custom bounds, and missing custom bounds", () => {
    expect(overviewQuerySchema.safeParse({ range: "custom", from: "2026-10-15", to: "2026-10-14" }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ range: "custom", from: "2026-02-30", to: "2026-03-01" }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ range: "custom" }).success).toBe(false);
  });
});
