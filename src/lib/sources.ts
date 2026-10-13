import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import { whereClause, type Scope } from "@/lib/analytics";

type SourceRow = { domain: string; type: string; citationCount: number; chatId: string; brandsFound: string | null };
type FoundBrand = { brandId?: unknown; name?: unknown };

function parseFound(value: string | null): FoundBrand[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is FoundBrand => typeof item === "object" && item !== null) : [];
  } catch { return []; }
}

/** Summarize cited domains over the same successful-answer scope used by analytics. */
export function getSources(scope: Scope, database: Database.Database = getSqlite()) {
  const where = whereClause(scope);
  const answers = (database.prepare(`SELECT COUNT(*) AS total FROM chats AS c ${where.sql}`).get(where.params) as { total: number }).total;
  const rows = database.prepare(`
    SELECT s.domain, s.type, cs.citation_count AS citationCount, c.id AS chatId,
      c.brands_found AS brandsFound
    FROM chats AS c
    JOIN chat_sources AS cs ON cs.chat_id = c.id
    JOIN sources AS s ON s.id = cs.source_id
    ${where.sql}
    ORDER BY s.domain, c.id
  `).all(where.params) as SourceRow[];
  const rivals = new Set((database.prepare("SELECT id FROM brands WHERE owner_brand_id = @brandId").all({ brandId: scope.brandId }) as Array<{ id: string }>).map(({ id }) => id));
  const grouped = new Map<string, { domain: string; type: string; citations: number; chats: Set<string>; citedWith: Set<string>; hasRival: boolean; hasOwn: boolean }>();
  const typeCounts = new Map<string, number>();
  for (const row of rows) {
    let source = grouped.get(row.domain);
    if (!source) {
      source = { domain: row.domain, type: row.type, citations: 0, chats: new Set(), citedWith: new Set(), hasRival: false, hasOwn: false };
      grouped.set(row.domain, source);
    }
    source.citations += row.citationCount;
    source.chats.add(row.chatId);
    typeCounts.set(row.type, (typeCounts.get(row.type) ?? 0) + row.citationCount);
    for (const found of parseFound(row.brandsFound)) {
      if (typeof found.name === "string") source.citedWith.add(found.name);
      if (typeof found.brandId === "string" && found.brandId === scope.brandId) source.hasOwn = true;
      if (typeof found.brandId === "string" && rivals.has(found.brandId)) source.hasRival = true;
    }
  }
  const toItem = (source: NonNullable<ReturnType<typeof grouped.get>>) => ({
    domain: source.domain,
    type: source.type,
    answers: source.chats.size,
    usedPercent: answers ? source.chats.size / answers * 100 : 0,
    averageCitations: source.chats.size ? source.citations / source.chats.size : 0,
    citations: source.citations,
    citedWith: [...source.citedWith].sort((a, b) => a.localeCompare(b)),
  });
  const domains = [...grouped.values()].map(toItem).sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain));
  const gapDomains = [...grouped.values()].filter((source) => source.hasRival && !source.hasOwn).map(toItem).sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain));
  const typeBreakdown = [...typeCounts.entries()].map(([type, citations]) => ({ type, citations })).sort((a, b) => b.citations - a.citations || a.type.localeCompare(b.type));
  return { answers, totalCitations: rows.reduce((total, row) => total + row.citationCount, 0), domains, gapDomains, typeBreakdown };
}
