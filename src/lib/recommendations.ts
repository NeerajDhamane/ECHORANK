import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import { whereClause, type Scope } from "@/lib/analytics";

type BrandHit = { brandId?: unknown; name?: unknown };
type RunChat = { id: string; promptId: string; mentioned: number; position: number | null; sentiment: string | null; citedSources: string | null; brandsFound: string | null };
type RuleCandidate = {
  rule: string; subject: string; category: "content" | "authority" | "technical"; priority: "high" | "medium" | "low";
  title: string; detail: string; evidence: Record<string, unknown>; basis: string;
};

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function foundBrands(row: RunChat): BrandHit[] {
  return parseJsonArray(row.brandsFound).filter((item): item is BrandHit => typeof item === "object" && item !== null);
}

function citedDomains(row: RunChat): string[] {
  return parseJsonArray(row.citedSources).filter((item): item is string => typeof item === "string");
}

function candidate(rule: string, subject: string, category: RuleCandidate["category"], priority: RuleCandidate["priority"], title: string, detail: string, evidence: Record<string, unknown>, basis: string): RuleCandidate {
  return { rule, subject, category, priority, title, detail, evidence: { rule, subject, ...evidence }, basis };
}

/** Evaluate transparent, per-latest-run recommendation heuristics; crawl rules await T023 data. */
export function evaluateRecommendationRules(brandId: string, runId: string, database: Database.Database = getSqlite()): RuleCandidate[] {
  const run = database.prepare("SELECT id FROM tracking_runs WHERE id = @runId AND brand_id = @brandId AND status = 'completed'").get({ runId, brandId });
  if (!run) return [];
  const scope: Scope = { brandId, runId };
  const where = whereClause(scope);
  const rows = database.prepare(`
    SELECT c.id, c.prompt_id AS promptId, c.mentioned, c.position, c.sentiment,
      c.cited_sources AS citedSources, c.brands_found AS brandsFound
    FROM chats AS c ${where.sql} ORDER BY c.created_at, c.id
  `).all(where.params) as RunChat[];
  if (!rows.length) return [];
  const recs: RuleCandidate[] = [];
  const sampleSize = rows.length;
  const ownMentions = rows.filter((row) => row.mentioned === 1);
  const ownVisibility = ownMentions.length / sampleSize;

  if (ownVisibility < 0.3) recs.push(candidate("R1", "brand", "content", "high", "Low AI visibility — publish buyer-intent content", `Your brand appeared in ${(ownVisibility * 100).toFixed(1)}% of ${sampleSize} successful answers in the latest run. Consider pages that directly answer the tracked buyer-intent prompts.`, { visibilityPercent: Number((ownVisibility * 100).toFixed(1)), mentions: ownMentions.length, sampleSize }, "This threshold is a project heuristic for prioritizing low observed visibility; it does not show that publishing content will cause visibility to change."));

  const uncitedMentions = ownMentions.filter((row) => citedDomains(row).length === 0).length;
  if (ownMentions.length && uncitedMentions / ownMentions.length >= 0.5) recs.push(candidate("R2", "brand", "authority", "medium", "Build third-party citation presence", `${uncitedMentions} of ${ownMentions.length} answers that mentioned you had no detected citation domains. Review frequently cited domains for relevant, legitimate listing opportunities.`, { uncitedMentions, mentionedAnswers: ownMentions.length, uncitedSharePercent: Number((uncitedMentions / ownMentions.length * 100).toFixed(1)) }, "This rule highlights an association between brand mentions and detected citations in this sample; it does not establish that third-party listings cause mentions."));

  const negativeMentions = ownMentions.filter((row) => row.sentiment === "negative").length;
  if (ownMentions.length && negativeMentions / ownMentions.length > 0.2) recs.push(candidate("R3", "brand", "content", "high", "Review recurring negative answer themes", `${negativeMentions} of ${ownMentions.length} answers that mentioned you were labeled negative. Review those answers for objections that your public content can address accurately.`, { negativeMentions, mentionedAnswers: ownMentions.length, negativeSharePercent: Number((negativeMentions / ownMentions.length * 100).toFixed(1)) }, "Sentiment labels are approximate text classifications. Review the source answers before changing content; the association is not evidence of cause."));

  const competitorIds = new Set((database.prepare("SELECT id FROM brands WHERE owner_brand_id = @brandId").all({ brandId }) as Array<{ id: string }>).map(({ id }) => id));
  const sourceRows = database.prepare(`
    SELECT s.domain, cs.chat_id AS chatId, c.mentioned, c.brands_found AS brandsFound
    FROM chat_sources AS cs JOIN sources AS s ON s.id = cs.source_id JOIN chats AS c ON c.id = cs.chat_id
    ${where.sql}
  `).all(where.params) as Array<{ domain: string; chatId: string; mentioned: number; brandsFound: string | null }>;
  const domainEvidence = new Map<string, { rivals: Set<string>; chatIds: Set<string>; own: boolean }>();
  for (const source of sourceRows) {
    let evidence = domainEvidence.get(source.domain);
    if (!evidence) { evidence = { rivals: new Set(), chatIds: new Set(), own: false }; domainEvidence.set(source.domain, evidence); }
    evidence.chatIds.add(source.chatId);
    if (source.mentioned === 1) evidence.own = true;
    for (const found of foundBrands({ ...source, id: source.chatId, promptId: "", position: null, sentiment: null, citedSources: null })) {
      if (typeof found.brandId === "string" && competitorIds.has(found.brandId)) evidence.rivals.add(found.brandId);
      if (typeof found.brandId === "string" && found.brandId === brandId) evidence.own = true;
    }
  }
  for (const [domain, evidence] of domainEvidence) {
    if (!evidence.own && evidence.rivals.size >= 2) recs.push(candidate("R4", domain, "authority", "high", `Build a legitimate presence on ${domain}`, `${domain} was cited in ${evidence.chatIds.size} answers that named ${evidence.rivals.size} tracked competitors, and never in an answer that named your brand.`, { domain, competitorCount: evidence.rivals.size, competitorIds: [...evidence.rivals], answers: evidence.chatIds.size }, "This is an observed source gap in the latest run. Pursue only relevant, accurate third-party coverage; do not post promotional or misleading material."));
  }

  const promptGroups = new Map<string, RunChat[]>();
  for (const row of rows) promptGroups.set(row.promptId, [...(promptGroups.get(row.promptId) ?? []), row]);
  const promptTexts = new Map((database.prepare("SELECT id, text FROM prompts WHERE brand_id = @brandId").all({ brandId }) as Array<{ id: string; text: string }>).map(({ id, text }) => [id, text]));
  for (const [promptId, promptRows] of promptGroups) {
    const promptRivals = new Map<string, number>();
    for (const row of promptRows) for (const hit of foundBrands(row)) if (typeof hit.brandId === "string" && competitorIds.has(hit.brandId)) promptRivals.set(hit.brandId, (promptRivals.get(hit.brandId) ?? 0) + 1);
    if (promptRows.some((row) => row.mentioned === 1)) continue;
    for (const [rivalId, rivalMentions] of promptRivals) {
      const rivalShare = rivalMentions / promptRows.length;
      if (rivalShare >= 0.6) recs.push(candidate("R5", `${promptId}:${rivalId}`, "content", "high", "Create a focused page for an uncovered prompt", `“${promptTexts.get(promptId) ?? "Tracked prompt"}” had ${rivalMentions} of ${promptRows.length} answers mention a competitor and none mention your brand.`, { promptId, prompt: promptTexts.get(promptId) ?? null, rivalId, rivalMentions, sampleSize: promptRows.length, rivalSharePercent: Number((rivalShare * 100).toFixed(1)), ownMentions: 0 }, "This prompt-level sample indicates a coverage opportunity, not a guarantee that a new page will change assistant responses."));
    }
  }

  const forumRows = database.prepare(`
    SELECT cs.chat_id AS chatId, cs.citation_count AS citationCount, c.mentioned
    FROM chat_sources AS cs JOIN sources AS s ON s.id = cs.source_id JOIN chats AS c ON c.id = cs.chat_id
    ${where.sql} AND s.type = 'forum'
  `).all(where.params) as Array<{ chatId: string; citationCount: number; mentioned: number }>;
  const allCitationTotal = (database.prepare(`SELECT COALESCE(SUM(cs.citation_count),0) AS total FROM chat_sources AS cs JOIN chats AS c ON c.id=cs.chat_id ${where.sql}`).get(where.params) as { total: number }).total;
  const forumCitationTotal = forumRows.reduce((sum, row) => sum + row.citationCount, 0);
  const forumOwnCitations = forumRows.filter((row) => row.mentioned === 1).reduce((sum, row) => sum + row.citationCount, 0);
  if (allCitationTotal > 0 && forumCitationTotal / allCitationTotal >= 0.2 && forumOwnCitations === 0) recs.push(candidate("R6", "forums", "authority", "medium", "Review relevant community coverage", `${forumCitationTotal} of ${allCitationTotal} citations (${(forumCitationTotal / allCitationTotal * 100).toFixed(1)}%) were forum sources, and none appeared in answers that mentioned your brand.`, { forumCitations: forumCitationTotal, totalCitations: allCitationTotal, forumSharePercent: Number((forumCitationTotal / allCitationTotal * 100).toFixed(1)), ownAssociatedForumCitations: forumOwnCitations }, "Forum citations are visible in this sample. If you participate, follow community rules and contribute useful, accurate answers without promotional manipulation."));

  const previousRuns = database.prepare(`
    SELECT DISTINCT r.id, r.started_at AS startedAt FROM tracking_runs AS r
    JOIN chats AS c ON c.run_id = r.id
    WHERE r.brand_id = @brandId AND r.status = 'completed' AND c.error IS NULL AND c.is_simulated = 0
    ORDER BY r.started_at DESC, r.id DESC LIMIT 2
  `).all({ brandId }) as Array<{ id: string; startedAt: string }>;
  if (previousRuns.length === 2) {
    const visibility = previousRuns.map((item) => {
      const runScope = whereClause({ brandId, runId: item.id });
      const total = database.prepare(`SELECT COUNT(*) AS total FROM chats AS c ${runScope.sql}`).get(runScope.params) as { total: number };
      const mentions = database.prepare(`SELECT COUNT(*) AS total FROM chats AS c ${runScope.sql} AND c.mentioned = 1`).get(runScope.params) as { total: number };
      return { runId: item.id, startedAt: item.startedAt, sampleSize: total.total, mentions: mentions.total, visibility: total.total ? mentions.total / total.total : 0 };
    });
    const previous = visibility[1]!;
    const latest = visibility[0]!;
    const drop = previous.visibility - latest.visibility;
    if (drop >= 0.1) recs.push(candidate("R7", "brand", "content", "medium", "Inspect the recent visibility decline", `Visibility decreased from ${(previous.visibility * 100).toFixed(1)}% to ${(latest.visibility * 100).toFixed(1)}% across the last two runs.`, { previous, latest, dropPercentagePoints: Number((drop * 100).toFixed(1)) }, "A two-run change can reflect sample variation. Compare the underlying Chats before deciding what changed."));
  }

  const rankRows = ownMentions.filter((row) => row.position !== null);
  const averageRank = rankRows.length ? rankRows.reduce((sum, row) => sum + (row.position ?? 0), 0) / rankRows.length : null;
  if (averageRank !== null && averageRank > 3) recs.push(candidate("R10", "brand", "content", "low", "Strengthen clear brand differentiators", `Your average position was ${averageRank.toFixed(2)} across ${rankRows.length} answers that mentioned you.`, { averageRank: Number(averageRank.toFixed(2)), rankedMentions: rankRows.length }, "Position is a coarse rank among recognized brands in these answers. Clear, verifiable differentiators may help readers understand your offer; the association is not causal."));

  if (recs.length === 0) recs.push(candidate("R11", "brand", "authority", "low", "Maintain and keep monitoring", `No recommendation thresholds were reached in the latest run (${sampleSize} successful answers).`, { sampleSize, evaluatedRules: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R10"] }, "This indicates only that the implemented thresholds were not crossed in this sample. Continue monitoring as data accumulates."));
  return recs;
}

/** Insert current candidates once per still-open rule and subject. */
export function generateRecommendations(brandId: string, runId?: string, database: Database.Database = getSqlite()) {
  const resolvedRun = runId ?? (database.prepare(`SELECT id FROM tracking_runs WHERE brand_id = @brandId AND status = 'completed' ORDER BY started_at DESC, id DESC LIMIT 1`).get({ brandId }) as { id: string } | undefined)?.id;
  if (!resolvedRun) return [];
  const candidates = evaluateRecommendationRules(brandId, resolvedRun, database);
  const insert = database.prepare(`INSERT INTO recommendations (id, brand_id, run_id, category, priority, title, detail, evidence, basis, status)
    SELECT @id, @brandId, @runId, @category, @priority, @title, @detail, @evidence, @basis, 'open'
    WHERE NOT EXISTS (
      SELECT 1 FROM recommendations WHERE brand_id = @brandId AND status IN ('open','in_progress')
        AND json_extract(evidence, '$.rule') = @rule AND json_extract(evidence, '$.subject') = @subject
    )`);
  const inserted = database.transaction(() => candidates.flatMap((item) => {
    const id = randomUUID();
    const result = insert.run({ id, brandId, runId: resolvedRun, ...item, evidence: JSON.stringify(item.evidence) });
    return result.changes ? [{ id, runId: resolvedRun, ...item, status: "open" as const }] : [];
  }))();
  return inserted;
}

export function listRecommendations(brandId: string, includeDone = false, database: Database.Database = getSqlite()) {
  return database.prepare(`SELECT id, brand_id AS brandId, run_id AS runId, category, priority, title, detail, evidence, basis, status, created_at AS createdAt
    FROM recommendations WHERE brand_id = @brandId ${includeDone ? "" : "AND status <> 'done'"}
    ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC, id`)
    .all({ brandId }) as Array<{ id: string; brandId: string; runId: string | null; category: string; priority: string; title: string; detail: string; evidence: string | null; basis: string | null; status: string; createdAt: string }>;
}

export function updateRecommendationStatus(brandId: string, recommendationId: string, status: "open" | "in_progress" | "done", database: Database.Database = getSqlite()) {
  return database.prepare(`UPDATE recommendations SET status = @status WHERE id = @id AND brand_id = @brandId`).run({ id: recommendationId, brandId, status }).changes > 0;
}
