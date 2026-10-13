import { z } from "zod";
import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import { whereClause, type Scope } from "@/lib/analytics";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";

const chatsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
  mentioned: z.enum(["true", "false"]).optional(),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
  runId: z.string().trim().min(1).max(100).optional(),
  brandFoundId: z.string().trim().min(1).max(100).optional(),
  source: z.string().trim().min(1).max(253).optional(),
  search: z.string().trim().max(200).optional(),
}).strict();

const overviewKeys = ["range", "from", "to", "platform", "promptId", "tagId", "locale", "includeSimulated"] as const;
const chatKeys = ["page", "limit", "mentioned", "sentiment", "runId", "brandFoundId", "source", "search"] as const;

export function parseChatsQuery(searchParams: URLSearchParams, brandId: string) {
  const all = Object.fromEntries(searchParams.entries());
  const base = overviewQuerySchema.safeParse(Object.fromEntries(overviewKeys.flatMap((key) => all[key] === undefined ? [] : [[key, all[key]]])));
  if (!base.success) return { success: false as const, error: base.error };
  const parsed = chatsQuerySchema.safeParse(Object.fromEntries(chatKeys.flatMap((key) => all[key] === undefined ? [] : [[key, all[key]]])));
  if (!parsed.success) return { success: false as const, error: parsed.error };
  const { mentioned, sentiment, runId, brandFoundId, source, search, page, limit } = parsed.data;
  const scope: Scope = {
    ...overviewScope(brandId, base.data),
    ...(mentioned !== undefined ? { mentioned: mentioned === "true" } : {}),
    ...(sentiment ? { sentiment } : {}),
    ...(runId ? { runId } : {}),
    ...(brandFoundId ? { brandFoundId } : {}),
    ...(source ? { source } : {}),
    ...(search ? { search } : {}),
  };
  return { success: true as const, data: { scope, page, limit } };
}

export type ChatListItem = {
  id: string;
  runId: string;
  promptId: string;
  prompt: string;
  topicName: string | null;
  startedAt: string | null;
  createdAt: string;
  platform: string;
  locale: string | null;
  isSimulated: number;
  mentioned: number;
  position: number | null;
  sentiment: string | null;
  brandsFound: Array<{ brandId: string; name: string; position: number; sentiment: string | null; sentimentScore: number | null }>;
  citedSources: string[];
};

type ChatListRow = Omit<ChatListItem, "brandsFound" | "citedSources"> & { brandsFound: string | null; citedSources: string | null };

function parseArray<T>(value: string | null, accept: (item: unknown) => item is T): T[] {
  if (!value) return [];
  try {
    const decoded: unknown = JSON.parse(value);
    return Array.isArray(decoded) ? decoded.filter(accept) : [];
  } catch {
    return [];
  }
}

function isBrandFound(item: unknown): item is ChatListItem["brandsFound"][number] {
  if (typeof item !== "object" || item === null) return false;
  const value = item as Record<string, unknown>;
  return typeof value.brandId === "string" && typeof value.name === "string" && typeof value.position === "number";
}

function toChatListItem(row: ChatListRow): ChatListItem {
  return {
    ...row,
    brandsFound: parseArray(row.brandsFound, isBrandFound),
    citedSources: parseArray(row.citedSources, (item): item is string => typeof item === "string"),
  };
}

export function getChatPage(scope: Scope, page = 1, limit = 50, database: Database.Database = getSqlite()) {
  const where = whereClause(scope);
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const count = database.prepare(`SELECT COUNT(*) AS total FROM chats AS c ${where.sql}`).get(where.params) as { total: number };
  const chats = database.prepare(`
    SELECT c.id, c.run_id AS runId, c.prompt_id AS promptId,
      COALESCE(p.text, 'Prompt removed') AS prompt, t.name AS topicName,
      r.started_at AS startedAt, c.created_at AS createdAt, c.platform,
      c.locale, c.is_simulated AS isSimulated, c.mentioned, c.position,
      c.sentiment, c.brands_found AS brandsFound, c.cited_sources AS citedSources
    FROM chats AS c
    LEFT JOIN prompts AS p ON p.id = c.prompt_id
    LEFT JOIN topics AS t ON t.id = p.topic_id
    LEFT JOIN tracking_runs AS r ON r.id = c.run_id
    ${where.sql}
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...where.params, limit: safeLimit, offset: (safePage - 1) * safeLimit }) as ChatListRow[];
  return {
    chats: chats.map(toChatListItem),
    total: count.total,
    page: safePage,
    limit: safeLimit,
    pages: Math.ceil(count.total / safeLimit),
  };
}

export function getChatDetail(scope: Scope, chatId: string, database: Database.Database = getSqlite()) {
  const where = whereClause(scope);
  const row = database.prepare(`
    SELECT c.id, c.run_id AS runId, c.prompt_id AS promptId,
      COALESCE(p.text, 'Prompt removed') AS prompt, t.name AS topicName,
      r.started_at AS startedAt, c.created_at AS createdAt, c.platform,
      c.locale, c.is_simulated AS isSimulated, c.mentioned, c.position,
      c.sentiment, c.sentiment_score AS sentimentScore, c.raw_response AS rawResponse,
      c.brands_found AS brandsFound, c.cited_sources AS citedSources
    FROM chats AS c
    LEFT JOIN prompts AS p ON p.id = c.prompt_id
    LEFT JOIN topics AS t ON t.id = p.topic_id
    LEFT JOIN tracking_runs AS r ON r.id = c.run_id
    ${where.sql} AND c.id = @chatId
  `).get({ ...where.params, chatId }) as (ChatListRow & { rawResponse: string | null; sentimentScore: number | null }) | undefined;
  if (!row) return null;
  const chat = toChatListItem(row);
  const sources = database.prepare(`
    SELECT s.domain, s.type, cs.citation_count AS citationCount
    FROM chat_sources AS cs JOIN sources AS s ON s.id = cs.source_id
    WHERE cs.chat_id = @chatId ORDER BY s.domain
  `).all({ chatId }) as Array<{ domain: string; type: string; citationCount: number }>;
  const brands = database.prepare(`
    SELECT id, name, aliases FROM brands WHERE id = @brandId OR owner_brand_id = @brandId
  `).all({ brandId: scope.brandId }) as Array<{ id: string; name: string; aliases: string | null }>;
  const foundIds = new Set(chat.brandsFound.map((item) => item.brandId));
  const foundBrands = brands.flatMap((brand) => {
    if (!foundIds.has(brand.id)) return [];
    let aliases: unknown = [];
    try { aliases = JSON.parse(brand.aliases ?? "[]") as unknown; } catch { aliases = []; }
    return [{ id: brand.id, name: brand.name, aliases: Array.isArray(aliases) ? aliases.filter((item): item is string => typeof item === "string") : [] }];
  });
  return { ...chat, sentimentScore: row.sentimentScore, rawResponse: row.rawResponse, sources, highlightBrands: foundBrands };
}
