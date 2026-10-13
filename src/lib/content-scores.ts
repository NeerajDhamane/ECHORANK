import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentScores } from "@/db/schema";
import { extractFeatures, scoreContent } from "@/lib/analysis/content-features";

type AppDatabase = typeof db;
export type ContentScoreHistoryItem = { id: string; label: string | null; score: number; createdAt: string };

export function getContentScoreHistory(brandId: string, database: AppDatabase = db): ContentScoreHistoryItem[] {
  return database.select({ id: contentScores.id, label: contentScores.label, score: contentScores.score, createdAt: contentScores.createdAt })
    .from(contentScores).where(eq(contentScores.brandId, brandId)).orderBy(desc(contentScores.createdAt), sql`rowid DESC`).limit(50).all()
    .map((item) => ({ ...item, createdAt: item.createdAt ?? "" }));
}

export function scoreAndSaveContent(brandId: string, content: string, label: string | undefined, database: AppDatabase = db) {
  const features = extractFeatures(content);
  const result = scoreContent(features);
  const latest = database.select({ score: contentScores.score, createdAt: contentScores.createdAt }).from(contentScores).where(eq(contentScores.brandId, brandId))
    .orderBy(desc(contentScores.createdAt), sql`rowid DESC`).get();
  const saved = database.insert(contentScores).values({ id: randomUUID(), brandId, label: label ?? null, content, features: JSON.stringify(features), score: result.score }).returning().get();
  return { ...result, features, previousScore: latest?.score ?? null, delta: latest ? result.score - latest.score : null, history: { id: saved.id, label: saved.label, score: saved.score, createdAt: saved.createdAt ?? "" } };
}
