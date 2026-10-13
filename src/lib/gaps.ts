import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import { whereClause, type Scope } from "@/lib/analytics";

type GapRow = { promptId: string; prompt: string; mentioned: number; brandsFound: string | null };
type FoundBrand = { brandId?: unknown; name?: unknown };

function parseFound(value: string | null): FoundBrand[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is FoundBrand => typeof item === "object" && item !== null) : [];
  } catch { return []; }
}

/** Rank active prompts by rival mention rate × the own-brand visibility gap. */
export function gapOpportunities(scope: Scope, database: Database.Database = getSqlite()) {
  const where = whereClause(scope);
  const rows = database.prepare(`
    SELECT c.prompt_id AS promptId, p.text AS prompt, c.mentioned, c.brands_found AS brandsFound
    FROM chats AS c JOIN prompts AS p ON p.id = c.prompt_id
    ${where.sql} AND p.status = 'active' AND p.deleted_at IS NULL
    ORDER BY c.prompt_id, c.created_at, c.id
  `).all(where.params) as GapRow[];
  const competitors = database.prepare("SELECT id, name FROM brands WHERE owner_brand_id = @brandId AND deleted_at IS NULL").all({ brandId: scope.brandId }) as Array<{ id: string; name: string }>;
  const activeCompetitors = new Map(competitors.map((competitor) => [competitor.id, competitor]));
  const groups = new Map<string, { prompt: string; answers: number; ownMentions: number; rivalHits: Map<string, number> }>();
  for (const row of rows) {
    let group = groups.get(row.promptId);
    if (!group) {
      group = { prompt: row.prompt, answers: 0, ownMentions: 0, rivalHits: new Map() };
      groups.set(row.promptId, group);
    }
    group.answers += 1;
    if (row.mentioned === 1) group.ownMentions += 1;
    const seenInAnswer = new Set(parseFound(row.brandsFound).map((hit) => hit.brandId).filter((id): id is string => typeof id === "string" && activeCompetitors.has(id)));
    for (const competitorId of seenInAnswer) group.rivalHits.set(competitorId, (group.rivalHits.get(competitorId) ?? 0) + 1);
  }

  return [...groups.entries()].flatMap(([promptId, group]) => {
    const yourRate = group.ownMentions / group.answers;
    const topRival = [...group.rivalHits.entries()].map(([id, hits]) => ({ ...activeCompetitors.get(id)!, hits, rate: hits / group.answers }))
      .sort((a, b) => b.rate - a.rate || b.hits - a.hits || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
    const rivalRate = topRival?.rate ?? 0;
    const opportunity = rivalRate * (1 - yourRate);
    if (opportunity <= 0 || !topRival) return [];
    return [{
      promptId,
      prompt: group.prompt,
      answers: group.answers,
      yourRate: Math.round(yourRate * 100),
      yourMentions: group.ownMentions,
      topRival: topRival.name,
      topRivalId: topRival.id,
      rivalRate: Math.round(rivalRate * 100),
      rivalMentions: topRival.hits,
      opportunity: Number(opportunity.toFixed(3)),
      lowData: group.answers < 3,
    }];
  }).sort((a, b) => b.opportunity - a.opportunity || b.answers - a.answers || a.promptId.localeCompare(b.promptId));
}
