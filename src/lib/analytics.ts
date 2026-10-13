import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import { toSqlTime } from "@/lib/time";

export type Scope = {
  brandId: string;
  dateFrom?: Date | string;
  /** Inclusive end date. A date-only value includes the full UTC day. */
  dateTo?: Date | string;
  platform?: string;
  promptId?: string;
  tagId?: string;
  locale?: string;
  includeSimulated?: boolean;
  mentioned?: boolean;
  sentiment?: string;
  runId?: string;
  brandFoundId?: string;
  source?: string;
  search?: string;
};

type QueryParams = Record<string, string | number>;
type ScopedChat = {
  runId: string;
  startedAt: string;
  platform: string;
  mentioned: number;
  position: number | null;
  sentiment: string | null;
  sentimentScore: number | null;
  brandsFound: string | null;
};
type BrandFound = { brandId?: unknown; name?: unknown };
type BrandLabel = { brandId: string; name: string };

function normalizeDate(value: Date | string): string {
  return toSqlTime(value);
}

function nextUtcDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return toSqlTime(date);
}

/** Build a fixed SQL predicate and named bindings for a chat scope. */
export function whereClause(scope: Scope): { sql: string; params: QueryParams } {
  const predicates = ["c.brand_id = @brandId", "c.error IS NULL"];
  const params: QueryParams = { brandId: scope.brandId };
  if (!scope.includeSimulated) predicates.push("c.is_simulated = 0");
  if (scope.dateFrom !== undefined) {
    predicates.push("c.created_at >= @dateFrom");
    params.dateFrom = normalizeDate(scope.dateFrom);
  }
  if (scope.dateTo !== undefined) {
    const dateTo = typeof scope.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(scope.dateTo)
      ? nextUtcDay(scope.dateTo)
      : normalizeDate(scope.dateTo);
    predicates.push(`c.created_at ${typeof scope.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(scope.dateTo) ? "<" : "<="} @dateTo`);
    params.dateTo = dateTo;
  }
  if (scope.platform !== undefined) { predicates.push("c.platform = @platform"); params.platform = scope.platform; }
  if (scope.promptId !== undefined) { predicates.push("c.prompt_id = @promptId"); params.promptId = scope.promptId; }
  if (scope.tagId !== undefined) {
    predicates.push("EXISTS (SELECT 1 FROM prompt_tags AS pt WHERE pt.prompt_id = c.prompt_id AND pt.tag_id = @tagId)");
    params.tagId = scope.tagId;
  }
  if (scope.locale !== undefined) { predicates.push("c.locale = @locale"); params.locale = scope.locale; }
  if (scope.mentioned !== undefined) { predicates.push("c.mentioned = @mentioned"); params.mentioned = scope.mentioned ? 1 : 0; }
  if (scope.sentiment !== undefined) { predicates.push("c.sentiment = @sentiment"); params.sentiment = scope.sentiment; }
  if (scope.runId !== undefined) { predicates.push("c.run_id = @runId"); params.runId = scope.runId; }
  if (scope.brandFoundId !== undefined) {
    predicates.push("EXISTS (SELECT 1 FROM json_each(c.brands_found) AS found_brand WHERE json_extract(found_brand.value, '$.brandId') = @brandFoundId)");
    params.brandFoundId = scope.brandFoundId;
  }
  if (scope.source !== undefined) {
    predicates.push("EXISTS (SELECT 1 FROM chat_sources AS filter_cs JOIN sources AS filter_s ON filter_s.id = filter_cs.source_id WHERE filter_cs.chat_id = c.id AND filter_s.domain = @source)");
    params.source = scope.source;
  }
  if (scope.search !== undefined) {
    predicates.push("EXISTS (SELECT 1 FROM prompts AS filter_prompt WHERE filter_prompt.id = c.prompt_id AND filter_prompt.text LIKE @search)");
    params.search = `%${scope.search}%`;
  }
  return { sql: `WHERE ${predicates.join(" AND ")}`, params };
}

function scopedChats(scope: Scope, database: Database.Database): ScopedChat[] {
  const where = whereClause(scope);
  return database.prepare(`
    SELECT c.run_id AS runId, r.started_at AS startedAt, c.platform, c.mentioned,
      c.position, c.sentiment, c.sentiment_score AS sentimentScore,
      c.brands_found AS brandsFound
    FROM chats AS c
    JOIN tracking_runs AS r ON r.id = c.run_id
    ${where.sql}
  `).all(where.params) as ScopedChat[];
}

function parseFound(value: string | null): BrandFound[] {
  if (!value) return [];
  try {
    const decoded: unknown = JSON.parse(value);
    return Array.isArray(decoded) ? decoded.filter((item): item is BrandFound => typeof item === "object" && item !== null) : [];
  } catch {
    return [];
  }
}

function trackedBrands(scope: Scope, database: Database.Database): BrandLabel[] {
  return database.prepare(`
    SELECT id AS brandId, name FROM brands
    WHERE id = @brandId OR owner_brand_id = @brandId
    ORDER BY CASE WHEN id = @brandId THEN 0 ELSE 1 END, name
  `).all({ brandId: scope.brandId }) as BrandLabel[];
}

/** Per-run visibility for the tracked brand and its competitors, with sample sizes. */
export function visibilityByRun(scope: Scope, database: Database.Database = getSqlite()) {
  const chatsInScope = scopedChats(scope, database);
  const labels = trackedBrands(scope, database);
  const runs = new Map<string, { runId: string; startedAt: string; sampleSize: number; counts: Map<string, number> }>();
  for (const row of chatsInScope) {
    let run = runs.get(row.runId);
    if (!run) {
      run = { runId: row.runId, startedAt: row.startedAt, sampleSize: 0, counts: new Map() };
      runs.set(row.runId, run);
    }
    run.sampleSize += 1;
    const foundIds = new Set(parseFound(row.brandsFound).map((item) => item.brandId).filter((id): id is string => typeof id === "string"));
    for (const brand of labels) if (foundIds.has(brand.brandId)) run.counts.set(brand.brandId, (run.counts.get(brand.brandId) ?? 0) + 1);
  }
  return [...runs.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.runId.localeCompare(b.runId)).map((run) => ({
    runId: run.runId,
    startedAt: run.startedAt,
    sampleSize: run.sampleSize,
    brands: labels.map((brand) => {
      const mentions = run.counts.get(brand.brandId) ?? 0;
      return { ...brand, mentions, visibility: run.sampleSize ? mentions / run.sampleSize : 0 };
    }),
  }));
}

/** Positive/neutral/negative counts among successful answers mentioning the own brand. */
export function sentimentBreakdown(scope: Scope, database: Database.Database = getSqlite()) {
  const rows = scopedChats(scope, database).filter((row) => row.mentioned === 1 && row.sentiment !== null && row.sentimentScore !== null);
  const positive = rows.filter((row) => row.sentiment === "positive").length;
  const neutral = rows.filter((row) => row.sentiment === "neutral").length;
  const negative = rows.filter((row) => row.sentiment === "negative").length;
  const averageScore = rows.length
    ? rows.reduce((total, row) => total + (((row.sentimentScore ?? 0) + 1) / 2) * 100, 0) / rows.length
    : null;
  return { n: rows.length, positive, neutral, negative, averageScore };
}

/** Own-brand visibility by provider platform. */
export function visibilityByPlatform(scope: Scope, database: Database.Database = getSqlite()) {
  const groups = new Map<string, { platform: string; sampleSize: number; mentions: number; rankTotal: number; rankN: number }>();
  for (const row of scopedChats(scope, database)) {
    let group = groups.get(row.platform);
    if (!group) {
      group = { platform: row.platform, sampleSize: 0, mentions: 0, rankTotal: 0, rankN: 0 };
      groups.set(row.platform, group);
    }
    group.sampleSize += 1;
    if (row.mentioned === 1) {
      group.mentions += 1;
      if (row.position !== null) { group.rankTotal += row.position; group.rankN += 1; }
    }
  }
  return [...groups.values()].sort((a, b) => a.platform.localeCompare(b.platform)).map(({ rankTotal, rankN, ...group }) => ({
    ...group,
    visibility: group.sampleSize ? group.mentions / group.sampleSize : 0,
    averageRank: rankN ? rankTotal / rankN : null,
  }));
}

/** Share of voice by tracked brand: answers containing the brand divided by scoped answers. */
export function shareOfVoice(scope: Scope, database: Database.Database = getSqlite()) {
  const rows = scopedChats(scope, database);
  const labels = trackedBrands(scope, database);
  const counts = new Map(labels.map(({ brandId }) => [brandId, 0]));
  for (const row of rows) {
    const foundIds = new Set(parseFound(row.brandsFound).map((item) => item.brandId).filter((id): id is string => typeof id === "string"));
    for (const brand of labels) if (foundIds.has(brand.brandId)) counts.set(brand.brandId, (counts.get(brand.brandId) ?? 0) + 1);
  }
  return labels.map((brand) => {
    const mentions = counts.get(brand.brandId) ?? 0;
    return { ...brand, mentions, sampleSize: rows.length, share: rows.length ? mentions / rows.length : 0 };
  });
}

/** Most frequently cited source domains in the scoped successful answers. */
export function topSources(scope: Scope, limit = 10, database: Database.Database = getSqlite()) {
  const where = whereClause(scope);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return database.prepare(`
    SELECT s.domain, s.type, COUNT(DISTINCT cs.chat_id) AS answers,
      SUM(cs.citation_count) AS citations
    FROM chats AS c
    JOIN chat_sources AS cs ON cs.chat_id = c.id
    JOIN sources AS s ON s.id = cs.source_id
    ${where.sql}
    GROUP BY s.id, s.domain, s.type
    ORDER BY citations DESC, s.domain ASC
    LIMIT @limit
  `).all({ ...where.params, limit: safeLimit }) as Array<{ domain: string; type: string; answers: number; citations: number }>;
}

/** Dashboard payload composed only from the shared scoped analytics. */
export function getOverview(scope: Scope, database: Database.Database = getSqlite()) {
  const rows = scopedChats(scope, database);
  const sampleSize = rows.length;
  const ownMentions = rows.filter((row) => row.mentioned === 1);
  const sentiment = sentimentBreakdown(scope, database);
  const platforms = visibilityByPlatform(scope, database);
  const sources = topSources(scope, 5, database).map((source) => ({
    ...source,
    usedPercent: sampleSize ? (source.answers / sampleSize) * 100 : 0,
    averageCitations: source.answers ? source.citations / source.answers : 0,
  }));
  const share = shareOfVoice(scope, database);
  const ownShare = share.find((item) => item.brandId === scope.brandId)?.share ?? 0;
  const recentWhere = whereClause(scope);
  const recentChats = database.prepare(`
    SELECT c.id, c.created_at AS createdAt, c.prompt_id AS promptId,
      p.text AS prompt, c.platform, c.mentioned, c.sentiment, c.is_simulated AS isSimulated
    FROM chats AS c
    JOIN prompts AS p ON p.id = c.prompt_id
    ${recentWhere.sql}
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT @recentLimit
  `).all({ ...recentWhere.params, recentLimit: 5 }) as Array<{
    id: string; createdAt: string; promptId: string; prompt: string; platform: string;
    mentioned: number; sentiment: string | null; isSimulated: number;
  }>;
  const positionRows = ownMentions.filter((row) => row.position !== null);
  const trend = visibilityByRun(scope, database);
  return {
    stats: {
      visibility: sampleSize ? ownMentions.length / sampleSize * 100 : null,
      visibilityN: sampleSize,
      averageRank: positionRows.length ? positionRows.reduce((total, row) => total + (row.position ?? 0), 0) / positionRows.length : null,
      rankN: positionRows.length,
      positiveSentiment: sentiment.n ? sentiment.positive / sentiment.n * 100 : null,
      sentimentN: sentiment.n,
      answers: sampleSize,
    },
    trend,
    sentiment,
    platforms,
    shareOfVoice: share.map((item) => ({ ...item, vsYou: item.share - ownShare })),
    sources,
    recentChats,
    simulatedIncluded: scope.includeSimulated === true,
  };
}
