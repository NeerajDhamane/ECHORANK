import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractFeatures } from "@/lib/analysis/content-features";
import { analyzeTrials, parseCitedSources, seededSourceOrder, trialsFromCsv, wilson } from "@/lib/research/experiment1";
import { checkManipulation } from "../scripts/experiment1/make-versions";
import { designSchema as runDesignSchema, versionsSchema } from "../scripts/experiment1/run";

const fixture = readFileSync(resolve(process.cwd(), "scripts/experiment1/fixtures/experiment-sample.csv"), "utf8");

describe("research experiment 1", () => {
  it("computes the 95% Wilson interval for 50 of 100 trials", () => {
    const interval = wilson(50, 100);
    expect(interval?.rate).toBe(0.5);
    expect(interval?.low).toBeCloseTo(0.4038, 3);
    expect(interval?.high).toBeCloseTo(0.5962, 3);
  });

  it("parses only valid, unique source citation labels", () => {
    expect(parseCitedSources("Answer [Source 3], then [source 1] [Source 3] [Source 0] [Source 8]", 3)).toEqual([0, 2]);
  });

  it("shuffles reproducibly per trial and distributes source positions", () => {
    const values = ["plain", "faq", "stats"] as const;
    expect(seededSourceOrder(values, 9, "trial-x")).toEqual(seededSourceOrder(values, 9, "trial-x"));
    const orders = new Set(Array.from({ length: 60 }, (_, index) => seededSourceOrder(values, 9, `trial-${index}`).join("/")));
    expect(orders.size).toBe(6);
  });

  it("matches the sample CSV's hand-counted per-version citation rates and position counts", () => {
    const trials = trialsFromCsv(fixture);
    const [model] = analyzeTrials(trials);
    expect(model).toMatchObject({ model: "Fixture Model", totalTrials: 7, successfulTrials: 6, failedTrials: 1 });
    expect(model?.versions.map(({ version, citedTrials, trials: n }) => [version, citedTrials, n])).toEqual([
      ["plain", 2, 6], ["faq", 3, 6], ["stats", 1, 6],
    ]);
    expect(model?.versions.map(({ rate }) => rate)).toEqual([2 / 6, 3 / 6, 1 / 6]);
    expect(model?.positionEffect.map(({ position, cited, presentations }) => [position, cited, presentations])).toEqual([[1, 2, 6], [2, 2, 6], [3, 2, 6]]);
    expect(model?.chiSquare?.statistic).toBeCloseTo(1);
    expect(model?.chiSquare?.pValue).toBeCloseTo(0.6065, 3);
  });

  it("checks that FAQ and numeric source forms differ on the intended content features", () => {
    const padding = "This fictional synthetic example contains no measured outcome or market claim. ".repeat(15);
    const versions = {
      plain: `Northstar is a fictional tool. The synthetic dataset lists a trial period and account options. This example has no security claims. ${padding}`,
      faq: `What is Northstar? Northstar is a fictional tool. Which options are listed? The example lists two plans. What claims are absent? It has no security claims. ${padding}`,
      stats: `Northstar is fictional. The synthetic example lists 25% and 50% figures, 3 plans, 12 items, and 4 options. These figures are sample data only. ${padding}`,
    };
    const check = checkManipulation(versions);
    expect(check.faqPass).toBe(true);
    expect(check.statsPass).toBe(true);
    expect(check.lengthPass).toBe(true);
    expect(check.features.faq.faqPairs).toBeGreaterThanOrEqual(3);
    expect(check.features.stats.numericRatio).toBeGreaterThan(extractFeatures(versions.plain).numericRatio);
  });

  it("validates the preregistered design and requires manual version review before a run", () => {
    const design = JSON.parse(readFileSync(resolve(process.cwd(), "research/experiment1/design.json"), "utf8")) as unknown;
    expect(runDesignSchema.parse(design)).toMatchObject({ seed: 20261014, repetitionsPerQuery: 15, topics: expect.arrayContaining([expect.objectContaining({ queries: expect.arrayContaining([expect.any(String)]) })]) });
    const reviewed = { reviewed: true, topics: [{ id: "topic", versions: { plain: "text", faq: "text", stats: "text" }, manipulationCheck: { lengthPass: true, faqPass: true, statsPass: true, features: {} } }] };
    expect(versionsSchema.safeParse(reviewed).success).toBe(true);
    expect(versionsSchema.safeParse({ ...reviewed, reviewed: false }).success).toBe(false);
  });
});
