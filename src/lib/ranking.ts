import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import { whereClause, type Scope } from "@/lib/analytics";
import { toSqlTime } from "@/lib/time";

type FoundBrand = { brandId?: unknown; position?: unknown; sentiment?: unknown; sentimentScore?: unknown };
type RankingChat = { mentioned: number; position: number | null; sentiment: string | null; sentimentScore: number | null; brandsFound: string | null };
type TrackedBrand = { id: string; name: string };
function parseFound(value: string | null): FoundBrand[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is FoundBrand => typeof item === "object" && item !== null) : [];
  } catch { return []; }
}

function labelScore(value: unknown): number | null {
  if (value === "positive") return 100;
  if (value === "neutral") return 50;
  if (value === "negative") return 0;
  return null;
}

function sentimentScore(hit: FoundBrand): number | null {
  if (typeof hit.sentimentScore === "number" && Number.isFinite(hit.sentimentScore)) return Math.max(0, Math.min(100, (hit.sentimentScore + 1) * 50));
  return labelScore(hit.sentiment);
}

function collectMetrics(scope: Scope, database: Database.Database, brands: TrackedBrand[]) {
  const where = whereClause(scope);
  const rows = database.prepare(`SELECT c.mentioned, c.position, c.sentiment, c.sentiment_score AS sentimentScore, c.brands_found AS brandsFound
    FROM chats AS c ${where.sql}`).all(where.params) as RankingChat[];
  const metrics = new Map(brands.map(({ id }) => [id, { mentions: 0, rankTotal: 0, rankN: 0, sentimentTotal: 0, sentimentN: 0 }]));
  for (const row of rows) {
    const hits = new Map<string, FoundBrand>();
    for (const hit of parseFound(row.brandsFound)) if (typeof hit.brandId === "string" && metrics.has(hit.brandId)) hits.set(hit.brandId, hit);
    if (row.mentioned === 1 && !hits.has(scope.brandId)) {
      hits.set(scope.brandId, { position: row.position, sentiment: row.sentiment, sentimentScore: row.sentimentScore ?? undefined });
    }
    for (const [brandId, hit] of hits) {
      const item = metrics.get(brandId)!;
      item.mentions += 1;
      const rank = typeof hit.position === "number" && Number.isFinite(hit.position)
        ? hit.position
        : brandId === scope.brandId ? row.position : null;
      if (typeof rank === "number" && rank > 0) { item.rankTotal += rank; item.rankN += 1; }
      const sentiment = sentimentScore(hit) ?? (brandId === scope.brandId ? labelScore(row.sentiment) : null);
      if (sentiment !== null) { item.sentimentTotal += sentiment; item.sentimentN += 1; }
    }
  }
  return { sampleSize: rows.length, metrics };
}

function instant(value: Date | string): Date {
  return new Date(`${toSqlTime(value).replace(" ", "T")}Z`);
}

function previousWindow(scope: Scope): Pick<Scope, "dateFrom" | "dateTo"> | null {
  if (scope.dateFrom === undefined || scope.dateTo === undefined) return null;
  const currentStart = instant(scope.dateFrom);
  const currentEnd = instant(scope.dateTo);
  const dateOnlyEnd = typeof scope.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(scope.dateTo);
  if (dateOnlyEnd) currentEnd.setUTCDate(currentEnd.getUTCDate() + 1);
  else currentEnd.setUTCSeconds(currentEnd.getUTCSeconds() + 1);
  const duration = currentEnd.getTime() - currentStart.getTime();
  if (!Number.isFinite(duration) || duration < 1_000) return null;
  const previousStart = new Date(currentStart.getTime() - duration);
  const previousEnd = new Date(currentStart.getTime() - 1_000);
  return { dateFrom: previousStart.toISOString(), dateTo: previousEnd.toISOString() };
}

/** Compare brand visibility, per-brand sentiment/rank, and mentions across equal windows. */
export function getRanking(scope: Scope, database: Database.Database = getSqlite()) {
  const brands = database.prepare(`SELECT id, name FROM brands
    WHERE (id = @brandId OR owner_brand_id = @brandId) AND deleted_at IS NULL
    ORDER BY CASE WHEN id = @brandId THEN 0 ELSE 1 END, name`).all({ brandId: scope.brandId }) as TrackedBrand[];
  const current = collectMetrics(scope, database, brands);
  const previous = previousWindow(scope);
  const previousData = previous ? collectMetrics({ ...scope, ...previous }, database, brands) : null;
  const items = brands.map((brand) => {
    const item = current.metrics.get(brand.id)!;
    const prior = previousData?.metrics.get(brand.id);
    const visibility = current.sampleSize ? item.mentions / current.sampleSize * 100 : 0;
    const previousVisibility = previousData?.sampleSize ? (prior?.mentions ?? 0) / previousData.sampleSize * 100 : null;
    return {
      brandId: brand.id,
      name: brand.name,
      isOwn: brand.id === scope.brandId,
      visibility,
      delta: previousVisibility === null ? null : visibility - previousVisibility,
      sentiment: item.sentimentN ? item.sentimentTotal / item.sentimentN : null,
      sentimentN: item.sentimentN,
      averageRank: item.rankN ? item.rankTotal / item.rankN : null,
      mentions: item.mentions,
      sampleSize: current.sampleSize,
      previousMentions: prior?.mentions ?? 0,
      previousSampleSize: previousData?.sampleSize ?? 0,
    };
  });
  const own = items.find((item) => item.isOwn);
  const rivals = items.filter((item) => !item.isOwn).sort((a, b) => b.visibility - a.visibility || a.name.localeCompare(b.name));
  return { items: own ? [own, ...rivals] : rivals, sampleSize: current.sampleSize, previousSampleSize: previousData?.sampleSize ?? 0, previousWindow: previous };
}
