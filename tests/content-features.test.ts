import { describe, expect, it } from "vitest";
import { extractFeatures, scoreContent } from "@/lib/analysis/content-features";

const faqPage = `<script type="application/ld+json">{"@type":"FAQPage"}</script>
<h1>Choosing a useful service</h1><h2>Common questions</h2><h2>How it works</h2>
<p>What does the service do? It helps teams organize daily work.</p>
<p>Who can use it? Small teams can begin with simple steps.</p>
<p>Can we change our plan? Yes, teams can adjust plans any time.</p>
<p>How do we get support? A real person can answer your questions.</p>
<p>Is our information private? Clear controls help teams manage access.</p>
<ul><li>Simple setup</li><li>Clear controls</li><li>Helpful support</li></ul>
<p>${Array.from({ length: 32 }, () => "Teams can plan work, share updates, and review clear results.").join(" ")}</p>`;
const statisticsPage = `Results 2021 2022 2023 2024 2025 2026 17 23 41 62 88 103 147 209 311 419 503 602 718 811 920. ${Array.from({ length: 20 }, () => "The 18.7% index increased 24.3% after 16 measured events across 11 regions.").join(" ")}`;

describe("content features and score", () => {
  it("scores readable FAQ content above statistics-dense prose", () => {
    const faq = scoreContent(extractFeatures(faqPage));
    const statistics = scoreContent(extractFeatures(statisticsPage));
    expect(extractFeatures(faqPage)).toMatchObject({ faqPairs: 5, headingCount: 3, bulletCount: 3, hasSchemaJsonLd: true });
    expect(faq.score).toBeGreaterThan(statistics.score);
    expect(faq.score).toBeLessThanOrEqual(100);
  });

  it("returns a specific non-empty fix for every failed check", () => {
    const result = scoreContent(extractFeatures("Short draft."));
    expect(result.checks.reduce((sum, item) => sum + item.pts, 0)).toBe(100);
    expect(result.failed.length).toBeGreaterThan(0);
    expect(result.failed.every((item) => item.fix.trim().length > 0)).toBe(true);
  });
});
