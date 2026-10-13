import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { analyzeTrials, renderReport, trialsFromCsv } from "@/lib/research/experiment1";

export function analyzeFile(input: string, outputDir = resolve(process.cwd(), "research")) {
  const trials = existsSync(input) ? trialsFromCsv(readFileSync(input, "utf8")) : [];
  const results = { analyzedAt: new Date().toISOString(), trials: trials.length, models: analyzeTrials(trials) };
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
  writeFileSync(resolve(outputDir, "report.md"), renderReport(results.models), "utf8");
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = resolve(process.argv.find((argument) => argument.startsWith("--input="))?.split("=")[1] ?? "research/trials.csv");
    const results = analyzeFile(input);
    process.stdout.write(`Analyzed ${results.trials} trials across ${results.models.length} model(s). Wrote research/results.json and research/report.md.\n`);
  } catch (caught) { process.stderr.write(`${caught instanceof Error ? caught.message : "Analysis failed."}\n`); process.exitCode = 1; }
}
