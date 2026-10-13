export const EXPERIMENT_VERSIONS = ["plain", "faq", "stats"] as const;
export type ExperimentVersion = typeof EXPERIMENT_VERSIONS[number];
export type ExperimentTrial = {
  trialId: string; model: string; date: string; seed: number; topic: string; query: string; rep: number;
  status: "success" | "failed"; presentation: string[]; citedVersions: ExperimentVersion[];
  citedPositions: Array<{ version: ExperimentVersion; position: number }>; error: string;
};
export type CitationStats = { version: ExperimentVersion; trials: number; citedTrials: number; rate: number | null; ci95: { low: number; high: number } | null };

export function wilson(successes: number, total: number, z = 1.96): { rate: number; low: number; high: number } | null {
  if (!Number.isFinite(successes) || !Number.isFinite(total) || total <= 0 || successes < 0 || successes > total || z <= 0) return null;
  const p = successes / total;
  const divisor = 1 + z * z / total;
  const center = p + z * z / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total);
  return { rate: p, low: Math.max(0, (center - margin) / divisor), high: Math.min(1, (center + margin) / divisor) };
}

export function parseCitedSources(answer: string, sourceCount: number): number[] {
  return [...new Set([...answer.matchAll(/\[\s*Source\s+(\d+)\s*\]/giu)]
    .map((match) => Number(match[1]) - 1)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < sourceCount))].sort((a, b) => a - b);
}

/** Seeded shuffle; same seed and trial identity always produces the same source order. */
export function seededSourceOrder<T>(items: readonly T[], seed: number, trialId: string): T[] {
  let state = (seed ^ hash32(trialId)) >>> 0;
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [output[index], output[swap]] = [output[swap]!, output[index]!];
  }
  return output;
}

function hash32(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/u, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/u, "")); rows.push(row); }
  return rows.filter((line) => line.some((value) => value.length > 0));
}

export function csvCell(value: string | number): string {
  const raw = String(value);
  const text = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export const TRIAL_CSV_HEADER = ["trialId", "model", "date", "seed", "topic", "query", "rep", "status", "presentation", "citedVersions", "citedPositions", "error"] as const;

export function trialToCsvRow(trial: ExperimentTrial): string {
  return [trial.trialId, trial.model, trial.date, trial.seed, trial.topic, trial.query, trial.rep, trial.status,
    trial.presentation.join(";"), trial.citedVersions.join(";"), trial.citedPositions.map((item) => `${item.version}:${item.position}`).join(";"), trial.error]
    .map(csvCell).join(",");
}

export function trialsFromCsv(text: string): ExperimentTrial[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const missingColumns = TRIAL_CSV_HEADER.filter((column) => !header.includes(column));
  if (missingColumns.length) throw new Error(`Trial CSV is missing required columns: ${missingColumns.join(", ")}`);
  const index = new Map(header.map((name, position) => [name, position]));
  const get = (row: string[], column: string) => row[index.get(column) ?? -1] ?? "";
  return rows.flatMap((row) => {
    const trialId = get(row, "trialId");
    const status = get(row, "status");
    if (!trialId || (status !== "success" && status !== "failed")) return [];
    const presentation = get(row, "presentation").split(";").filter((item): item is ExperimentVersion => EXPERIMENT_VERSIONS.some((version) => version === item));
    const citedVersions = get(row, "citedVersions").split(";").filter((item): item is ExperimentVersion => EXPERIMENT_VERSIONS.some((version) => version === item));
    const citedPositions = get(row, "citedPositions").split(";").flatMap((item) => {
      const match = /^(plain|faq|stats):(\d+)$/u.exec(item);
      return match ? [{ version: match[1] as ExperimentVersion, position: Number(match[2]) }] : [];
    });
    return [{ trialId, model: get(row, "model"), date: get(row, "date"), seed: Number(get(row, "seed")), topic: get(row, "topic"), query: get(row, "query"), rep: Number(get(row, "rep")), status, presentation, citedVersions, citedPositions, error: get(row, "error") }];
  });
}

function chiSquareUniform(counts: number[]): { statistic: number; degreesFreedom: number; pValue: number } | null {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (counts.length < 2 || total === 0) return null;
  const expected = total / counts.length;
  const statistic = counts.reduce((sum, value) => sum + (value - expected) ** 2 / expected, 0);
  // For three source forms (df=2), the chi-square survival function is exactly exp(-x/2).
  const degreesFreedom = counts.length - 1;
  const pValue = degreesFreedom === 2 ? Math.exp(-statistic / 2) : Number.NaN;
  return { statistic, degreesFreedom, pValue };
}

export function analyzeTrials(trials: ExperimentTrial[]) {
  const models = [...new Set(trials.map((trial) => trial.model).filter(Boolean))].sort();
  return models.map((model) => {
    const modelTrials = trials.filter((trial) => trial.model === model);
    const successes = modelTrials.filter((trial) => trial.status === "success");
    const failures = modelTrials.length - successes.length;
    const versions: CitationStats[] = EXPERIMENT_VERSIONS.map((version) => {
      const citedTrials = successes.filter((trial) => trial.citedVersions.includes(version)).length;
      const interval = wilson(citedTrials, successes.length);
      return { version, trials: successes.length, citedTrials, rate: interval?.rate ?? null, ci95: interval ? { low: interval.low, high: interval.high } : null };
    });
    const positionEffect = [1, 2, 3].map((position) => {
      const presented = successes.flatMap((trial) => trial.presentation[position - 1] ? [trial.presentation[position - 1]!] : []);
      const cited = successes.flatMap((trial) => trial.citedPositions.filter((item) => item.position === position).map((item) => item.version));
      return { position, presentations: presented.length, cited: cited.length, rate: presented.length ? cited.length / presented.length : null };
    });
    const citationCounts = EXPERIMENT_VERSIONS.map((version) => successes.flatMap((trial) => trial.citedVersions.filter((item) => item === version)).length);
    return { model, totalTrials: modelTrials.length, successfulTrials: successes.length, failedTrials: failures, versions, chiSquare: chiSquareUniform(citationCounts), positionEffect };
  });
}

export function renderReport(summary: ReturnType<typeof analyzeTrials>): string {
  const lines = ["# Experiment 1: in-context citation form pilot", "", "This report describes associations in a small, in-context sample. It does not establish that content form causes citations or generalize to live web retrieval. Wilson intervals and chi-square p-values are exploratory: repeated queries may be dependent, while these calculations treat observations as independent.", ""];
  if (summary.length === 0) return [...lines, "No trial results are available yet. Run `npm run experiment1:analyze` after collecting trials.", ""].join("\n");
  for (const model of summary) {
    lines.push(`## ${model.model}`, "", `Successful trials: ${model.successfulTrials}; failed (retained, excluded from denominator): ${model.failedTrials}.`, "", "| Version | Cited trials | Successful trials | Citation rate | Wilson 95% CI |", "|---|---:|---:|---:|---:|");
    for (const version of model.versions) lines.push(`| ${version.version} | ${version.citedTrials} | ${version.trials} | ${version.rate === null ? "n/a" : `${(version.rate * 100).toFixed(1)}%`} | ${version.ci95 ? `${(version.ci95.low * 100).toFixed(1)}–${(version.ci95.high * 100).toFixed(1)}%` : "n/a"} |`);
    lines.push("", "| Presented position | Cited / presented | Citation rate |", "|---:|---:|---:|");
    for (const effect of model.positionEffect) lines.push(`| ${effect.position} | ${effect.cited} / ${effect.presentations} | ${effect.rate === null ? "n/a" : `${(effect.rate * 100).toFixed(1)}%`} |`);
    lines.push("", `Uniform three-way chi-square: ${model.chiSquare ? `χ²(${model.chiSquare.degreesFreedom})=${model.chiSquare.statistic.toFixed(3)}, p=${model.chiSquare.pValue.toFixed(4)}` : "not available (no citations)"}.`, "");
  }
  lines.push("## Published comparison (context only)", "", "| Source form | Published GPT-4o result |", "|---|---:|", "| FAQ | 83.4% |", "| Plain | 81.1% |", "| Statistics-dense | 59.3% |", "", "These published values are context, not a target. This pilot uses different providers, synthetic source text, a smaller sample, and in-context citations rather than live retrieval.", "");
  return lines.join("\n");
}
