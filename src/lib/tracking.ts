import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, getSqlite } from "@/db";
import { chats, prompts, trackingRuns } from "@/db/schema";
import { detectBrands } from "@/lib/analysis/mentions";
import { scoreSentiment } from "@/lib/analysis/sentiment";
import { extractCitations, persistSources, type Citation } from "@/lib/analysis/citations";
import { getCompetitors, type BrandRecord } from "@/lib/brand-access";
import { getProviders } from "@/lib/providers/registry";
import { createThrottle, withRetry } from "@/lib/providers/throttle";
import type { AIProvider } from "@/lib/providers/types";
import { generateRecommendations } from "@/lib/recommendations";
import { evaluateAlerts } from "@/lib/alerts";

type AppDatabase = typeof db;
type RetryText = (operation: () => Promise<string>) => Promise<string>;
type TrackingDependencies = {
  database?: AppDatabase;
  throttle?: (providerId: string) => Promise<void>;
  retry?: RetryText;
  saveSources?: (chatId: string, citations: Citation[], ownDomains: string[]) => void;
};

export type CreatedTrackingRun = { runId: string; totalExpected: number; status: "running" };

/** Create a run using the current active-prompt and provider counts. */
export function createTrackingRun(
  brandId: string,
  providers: AIProvider[] = getProviders(),
  database: AppDatabase = db,
  trigger: "manual" | "scheduled" = "manual",
): CreatedTrackingRun {
  const activePrompts = database.select({ id: prompts.id }).from(prompts).where(and(
    eq(prompts.brandId, brandId), eq(prompts.status, "active"), isNull(prompts.deletedAt),
  )).all();
  const runId = randomUUID();
  const totalExpected = activePrompts.length * providers.length;
  database.insert(trackingRuns).values({
    id: runId, brandId, status: "running", trigger, totalExpected,
  }).run();
  return { runId, totalExpected, status: "running" };
}

function recordFailure(
  database: AppDatabase,
  runId: string,
  brandId: string,
  promptId: string,
  provider: AIProvider,
  locale: string,
): void {
  database.insert(chats).values({
    id: randomUUID(), runId, promptId, brandId, platform: provider.label, locale,
    isSimulated: provider.isMock ? 1 : 0, rawResponse: null, mentioned: 0,
    position: null, sentiment: null, sentimentScore: null, brandsFound: "[]", citedSources: "[]",
    error: "Provider request failed.",
  }).run();
}

/** Generate and analyze every active prompt/provider pair, recording failures without stopping the run. */
export async function runTracking(
  runId: string,
  brand: BrandRecord,
  providers: AIProvider[] = getProviders(),
  dependencies: TrackingDependencies = {},
): Promise<void> {
  const database = dependencies.database ?? db;
  const throttle = dependencies.throttle ?? createThrottle(2_200);
  const retry = dependencies.retry ?? withRetry;
  const saveSources = dependencies.saveSources ?? ((chatId, citations, ownDomains) => {
    persistSources(getSqlite(), chatId, citations, ownDomains);
  });

  try {
    const run = database.select().from(trackingRuns).where(eq(trackingRuns.id, runId)).get();
    if (!run || run.status !== "running" || run.brandId !== brand.id) return;
    const activePrompts = database.select().from(prompts).where(and(
      eq(prompts.brandId, brand.id), eq(prompts.status, "active"), isNull(prompts.deletedAt),
    )).orderBy(prompts.createdAt, prompts.id).all();
    const activeCompetitors = getCompetitors(brand.id, database).map(({ id, name, aliases }) => ({ id, name, aliases }));
    const brandRefs = [{ id: brand.id, name: brand.name, aliases: brand.aliases }, ...activeCompetitors];
    const ownDomains = brand.website ? [brand.website] : [];

    for (const prompt of activePrompts) {
      for (const provider of providers) {
        const locale = prompt.locale ?? "global";
        try {
          if (!provider.isMock) await throttle(provider.id);
          const response = await retry(() => provider.run(prompt.text, { locale, brandName: brand.name }));
          const hits = detectBrands(response, brandRefs);
          const found = hits.map((hit) => {
            const sentiment = scoreSentiment(response, hit.index);
            return {
              brandId: hit.brandId,
              name: hit.name,
              position: hit.position,
              sentiment: sentiment?.label ?? null,
              sentimentScore: sentiment?.score ?? null,
            };
          });
          const ownHit = hits.find((hit) => hit.brandId === brand.id);
          const ownSentiment = ownHit ? scoreSentiment(response, ownHit.index) : null;
          const citations = extractCitations(response);
          const chatId = randomUUID();
          database.insert(chats).values({
            id: chatId, runId, promptId: prompt.id, brandId: brand.id,
            platform: provider.label, locale, isSimulated: provider.isMock ? 1 : 0,
            rawResponse: response, mentioned: ownHit ? 1 : 0, position: ownHit?.position ?? null,
            sentiment: ownSentiment?.label ?? null, sentimentScore: ownSentiment?.score ?? null,
            brandsFound: JSON.stringify(found), citedSources: JSON.stringify(citations.map(({ domain }) => domain)), error: null,
          }).run();
          saveSources(chatId, citations, ownDomains);
        } catch {
          recordFailure(database, runId, brand.id, prompt.id, provider, locale);
        }
      }
    }

    database.update(trackingRuns).set({ status: "completed", finishedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
      .where(eq(trackingRuns.id, runId)).run();
    if (database === db) {
      try { generateRecommendations(brand.id, runId); } catch { /* recommendation failures do not invalidate completed tracking data */ }
      try { evaluateAlerts(brand.id, runId); } catch { /* alert failures do not invalidate completed tracking data */ }
    }
  } catch {
    database.update(trackingRuns).set({ status: "failed", finishedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
      .where(eq(trackingRuns.id, runId)).run();
  }
}

export function getRecentRuns(brandId: string, limit = 10, database: AppDatabase = db) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const runs = database.select().from(trackingRuns).where(eq(trackingRuns.brandId, brandId))
    .orderBy(desc(trackingRuns.startedAt)).limit(safeLimit).all();
  return runs.map((run) => {
    const rows = database.select({ isSimulated: chats.isSimulated }).from(chats).where(eq(chats.runId, run.id)).all();
    return {
      runId: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt,
      totalExpected: run.totalExpected, completed: rows.length,
      simulatedCount: rows.filter((row) => row.isSimulated === 1).length,
    };
  });
}

export function getRunStatus(runId: string, database: AppDatabase = db) {
  const run = database.select().from(trackingRuns).where(eq(trackingRuns.id, runId)).get();
  if (!run) return null;
  const rows = database.select({ isSimulated: chats.isSimulated }).from(chats).where(eq(chats.runId, runId)).all();
  return {
    runId: run.id, brandId: run.brandId, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt,
    totalExpected: run.totalExpected, completed: rows.length,
    simulatedCount: rows.filter((row) => row.isSimulated === 1).length,
  };
}
