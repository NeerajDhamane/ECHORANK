import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { extractFeatures } from "@/lib/analysis/content-features";
import { getProviders } from "@/lib/providers/registry";
import { createThrottle, withRetry } from "@/lib/providers/throttle";

const forms = ["plain", "faq", "stats"] as const;

export const designSchema = z.object({
  title: z.string(), language: z.string(), versions: z.array(z.enum(forms)), repetitionsPerQuery: z.number().int().positive(), seed: z.number().int().nonnegative(),
  topics: z.array(z.object({ id: z.string(), name: z.string(), facts: z.array(z.string()), queries: z.array(z.string()) })),
}).strict();
type VersionForm = typeof forms[number];
const root = resolve(process.cwd(), "research/experiment1");

export function checkManipulation(versions: Record<VersionForm, string>) {
  const features = Object.fromEntries(forms.map((form) => [form, extractFeatures(versions[form])])) as Record<VersionForm, ReturnType<typeof extractFeatures>>;
  return {
    features,
    lengthPass: forms.every((form) => features[form].wordCount >= 180 && features[form].wordCount <= 280),
    faqPass: features.faq.faqPairs >= 3,
    statsPass: features.stats.numericRatio >= 0.02 && features.stats.numericRatio > features.plain.numericRatio,
  };
}

function generationPrompt(topic: string, facts: string[], form: VersionForm): string {
  const formatting = form === "plain"
    ? "Write connected plain prose without headings, lists, questions, or FAQ formatting."
    : form === "faq"
      ? "Write 3–4 genuine question-and-answer pairs, with each question ending in a question mark and a direct answer immediately following. Avoid dense numeric presentation."
      : "Write plain prose with at least four explicit numeric or percentage figures. Do not add headings or FAQ pairs.";
  return `Prepare one controlled source text for topic: ${topic}. Use approximately 200–250 words. ${formatting}\n\nUse only these facts, preserve their meaning, and introduce no outside facts or claims:\n- ${facts.join("\n- ")}\n\nReturn only the source text. These are fictional synthetic experiment facts.`;
}

async function main() {
  const providerId = process.argv.find((argument) => argument.startsWith("--provider="))?.split("=")[1];
  if (!providerId || !["groq", "gemini"].includes(providerId)) throw new Error("Choose one real configured provider: --provider=groq or --provider=gemini");
  const provider = getProviders().find((item) => item.id === providerId && !item.isMock);
  if (!provider) throw new Error(`Provider ${providerId} needs its API key in the environment. No simulated model is used for research source generation.`);
  const design = designSchema.parse(JSON.parse(readFileSync(resolve(root, "design.json"), "utf8")) as unknown);
  const throttle = createThrottle(2_200);
  const topics = [];
  for (const topic of design.topics) {
    const versions = {} as Record<VersionForm, string>;
    for (const form of forms) {
      await throttle(provider.id);
      versions[form] = (await withRetry(() => provider.run(generationPrompt(topic.name, topic.facts, form)))).trim();
    }
    const check = checkManipulation(versions);
    const entry = { id: topic.id, name: topic.name, queries: topic.queries, versions, manipulationCheck: { lengthPass: check.lengthPass, faqPass: check.faqPass, statsPass: check.statsPass, features: check.features } };
    topics.push(entry);
    process.stdout.write(`${topic.id}: length ${check.lengthPass ? "pass" : "REVIEW"}; FAQ ${check.faqPass ? "pass" : "REVIEW"}; stats ${check.statsPass ? "pass" : "REVIEW"}\n`);
  }
  const output = { generatedAt: new Date().toISOString(), provider: provider.label, reviewed: false, note: "Review semantic fact consistency manually, then set reviewed=true before any trial run.", topics };
  writeFileSync(resolve(root, "versions.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${topics.length} topic version sets to research/experiment1/versions.json. Review before running trials.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((caught: unknown) => { process.stderr.write(`${caught instanceof Error ? caught.message : "Version generation failed."}\n`); process.exitCode = 1; });
}
