import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const versionSchema = z.object({
  version: z.enum(["plain", "faq", "stats"]),
  trials: z.number().int().nonnegative(),
  citedTrials: z.number().int().nonnegative(),
  rate: z.number().min(0).max(1).nullable(),
  ci95: z.object({ low: z.number().min(0).max(1), high: z.number().min(0).max(1) }).nullable(),
});

const modelSchema = z.object({
  model: z.string().min(1),
  totalTrials: z.number().int().nonnegative(),
  successfulTrials: z.number().int().nonnegative(),
  failedTrials: z.number().int().nonnegative(),
  versions: z.array(versionSchema),
});

const resultsSchema = z.object({
  analyzedAt: z.string(),
  trials: z.number().int().nonnegative(),
  models: z.array(modelSchema),
});

export type ResearchModel = z.infer<typeof modelSchema>;
export type ResearchResults = z.infer<typeof resultsSchema>;

export function readResearchResults(): ResearchResults | null {
  const filePath = join(process.cwd(), "research", "results.json");
  if (!existsSync(filePath)) return null;
  try {
    return resultsSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
}
