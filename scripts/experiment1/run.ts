import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { getProviders } from "@/lib/providers/registry";
import { createThrottle, withRetry } from "@/lib/providers/throttle";
import { EXPERIMENT_VERSIONS, parseCitedSources, seededSourceOrder, TRIAL_CSV_HEADER, trialToCsvRow, trialsFromCsv, type ExperimentTrial, type ExperimentVersion } from "@/lib/research/experiment1";

const root = resolve(process.cwd(), "research/experiment1");
export const designSchema = z.object({ title: z.string(), language: z.string(), versions: z.array(z.enum(EXPERIMENT_VERSIONS)), repetitionsPerQuery: z.number().int().positive(), seed: z.number().int().nonnegative(), topics: z.array(z.object({ id: z.string(), queries: z.array(z.string().min(1)) })) }).strict();
export const versionsSchema = z.object({
  reviewed: z.literal(true), generatedAt: z.string().optional(), provider: z.string().optional(), note: z.string().optional(),
  topics: z.array(z.object({
    id: z.string(), versions: z.object({ plain: z.string(), faq: z.string(), stats: z.string() }).strict(),
    manipulationCheck: z.object({ lengthPass: z.boolean(), faqPass: z.boolean(), statsPass: z.boolean(), features: z.record(z.string(), z.unknown()) }).strict(),
  })),
}).strict();

export function createTrialPrompt(query: string, presented: Array<{ version: ExperimentVersion; text: string }>): string {
  return `Answer the question using the sources below. Use only relevant facts from those sources. Cite the sources you actually use with their exact label, such as [Source 1]. Do not cite a source you did not use.\nQuestion: ${query}\n\n${presented.map((item, index) => `[Source ${index + 1}]\n${item.text}`).join("\n\n")}`;
}

function trialId(model: string, topic: string, query: string, rep: number, seed: number): string {
  return [model, topic, query, rep, seed].map((part) => encodeURIComponent(part)).join("|");
}

async function main() {
  const providerId = process.argv.find((argument) => argument.startsWith("--provider="))?.split("=")[1];
  if (!providerId || !["groq", "gemini"].includes(providerId)) throw new Error("Choose one real configured provider: --provider=groq or --provider=gemini");
  const provider = getProviders().find((item) => item.id === providerId && !item.isMock);
  if (!provider) throw new Error(`Provider ${providerId} needs its API key. Live research never falls back to simulated output.`);
  const design = designSchema.parse(JSON.parse(readFileSync(resolve(root, "design.json"), "utf8")) as unknown);
  const versions = versionsSchema.parse(JSON.parse(readFileSync(resolve(root, "versions.json"), "utf8")) as unknown);
  const versionByTopic = new Map(versions.topics.map((topic) => [topic.id, topic.versions]));
  for (const topic of versions.topics) if (!topic.manipulationCheck.lengthPass || !topic.manipulationCheck.faqPass || !topic.manipulationCheck.statsPass) throw new Error(`Manipulation check failed for ${topic.id}; fix/review versions before starting any trials.`);
  const seed = design.seed;
  const output = resolve(process.cwd(), "research/trials.csv");
  mkdirSync(root, { recursive: true });
  const existingCsv = existsSync(output) ? readFileSync(output, "utf8") : "";
  if (!existingCsv.trim()) writeFileSync(output, `${TRIAL_CSV_HEADER.join(",")}\n`, "utf8");
  const prior = trialsFromCsv(existingCsv);
  const completeIds = new Set(prior.map((trial) => trial.trialId));
  const throttle = createThrottle(2_200);
  const runDate = new Date().toISOString().slice(0, 10);
  let completed = 0;
  for (const topic of design.topics) {
    const sourceVersions = versionByTopic.get(topic.id);
    if (!sourceVersions || EXPERIMENT_VERSIONS.some((version) => typeof sourceVersions[version] !== "string" || !sourceVersions[version]?.trim())) throw new Error(`Missing reviewed source versions for ${topic.id}; run make-versions first.`);
    for (let queryIndex = 0; queryIndex < topic.queries.length; queryIndex += 1) {
      const query = topic.queries[queryIndex]!;
      for (let rep = 1; rep <= design.repetitionsPerQuery; rep += 1) {
        const id = trialId(provider.label, topic.id, query, rep, seed);
        if (completeIds.has(id)) continue;
        const shuffled = seededSourceOrder(EXPERIMENT_VERSIONS, seed, id);
        const presented = shuffled.map((version) => ({ version, text: sourceVersions[version]! }));
        let trial: ExperimentTrial;
        try {
          const answer = await withRetry(async () => { await throttle(provider.id); return provider.run(createTrialPrompt(query, presented)); });
          const citedSourceIndexes = parseCitedSources(answer, presented.length);
          const citedPositions = citedSourceIndexes.map((index) => ({ version: presented[index]!.version, position: index + 1 }));
          trial = { trialId: id, model: provider.label, date: runDate, seed, topic: topic.id, query, rep, status: "success", presentation: shuffled, citedVersions: citedPositions.map(({ version }) => version), citedPositions, error: "" };
        } catch (caught) {
          trial = { trialId: id, model: provider.label, date: runDate, seed, topic: topic.id, query, rep, status: "failed", presentation: shuffled, citedVersions: [], citedPositions: [], error: caught instanceof Error ? caught.message.slice(0, 300) : "Provider request failed." };
        }
        appendFileSync(output, `${trialToCsvRow(trial)}\n`, "utf8");
        completeIds.add(id); completed += 1;
        process.stdout.write(`${trial.status} ${completed} new; ${topic.id} query ${queryIndex + 1}/${topic.queries.length} repetition ${rep}/${design.repetitionsPerQuery}\n`);
      }
    }
  }
  process.stdout.write(`Run complete. Added ${completed} trials to research/trials.csv; existing trial IDs were skipped.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((caught: unknown) => { process.stderr.write(`${caught instanceof Error ? caught.message : "Experiment run failed."}\n`); process.exitCode = 1; });
}
