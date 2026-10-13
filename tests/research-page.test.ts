import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResearchResultsView } from "@/components/research-results";
import { analyzeTrials, trialsFromCsv } from "@/lib/research/experiment1";
import { readResearchResults } from "@/lib/research-page";

describe("research page", () => {
  it("renders sample analysis with confidence intervals and published comparison", () => {
    const fixturePath = resolve(process.cwd(), "scripts/experiment1/fixtures/experiment-sample.csv");
    const trials = trialsFromCsv(readFileSync(fixturePath, "utf8"));
    const results = { analyzedAt: "2026-10-14T00:00:00.000Z", trials: trials.length, models: analyzeTrials(trials) };
    const markup = renderToStaticMarkup(createElement(ResearchResultsView, { results }));

    expect(markup).toContain("Citation rates and Wilson 95% confidence intervals for Fixture Model");
    expect(markup).toContain("Citation rate");
    expect(markup).toContain("Wilson 95% CI");
    expect(markup).toContain("n=2/6");
    expect(markup).toContain("83.4%");
    expect(markup).toContain("59.3%");
    expect(markup).toContain("Results describe associations");
  });

  it("shows the empty state when results.json is absent", () => {
    const result = readResearchResults();
    const markup = renderToStaticMarkup(createElement(ResearchResultsView, { results: result }));

    expect(result).toBeNull();
    expect(markup).toContain("No analyzed results yet");
    expect(markup).toContain("npm run experiment1:analyze");
  });
});
