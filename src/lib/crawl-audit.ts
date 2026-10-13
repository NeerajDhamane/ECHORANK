import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { getSqlite } from "@/db";
import { db } from "@/db";
import { crawlAudits } from "@/db/schema";
import { safeFetch } from "@/lib/safe-fetch";

export const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"] as const;
export type CrawlCheck = { id: string; ok: boolean; pts: number; detail: string; fix: string };
type Fetcher = typeof safeFetch;
type RobotsGroup = { agents: string[]; rules: Array<{ allow: boolean; path: string }> };

function robotGroups(source: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let group: RobotsGroup | null = null;
  let hasRule = false;
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.replace(/#.*/u, "").trim();
    const match = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/iu);
    if (!match) continue;
    const field = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (field === "user-agent") {
      if (!group || hasRule) { group = { agents: [], rules: [] }; groups.push(group); hasRule = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && value) {
      group.rules.push({ allow: field === "allow", path: value }); hasRule = true;
    }
  }
  return groups;
}

export function isBlockedFor(robots: string, bot: string, path = "/"): boolean {
  const groups = robotGroups(robots);
  const agent = bot.toLowerCase();
  const exact = groups.filter((group) => group.agents.some((name) => name !== "*" && (agent === name || agent.startsWith(name))));
  const selected = exact.length ? exact : groups.filter((group) => group.agents.includes("*"));
  if (!selected.length) return false;
  const rules = selected.flatMap((group) => group.rules).filter((rule) => path.startsWith(rule.path));
  rules.sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow === false;
}

function countWords(html: string): number {
  const visible = html.replace(/<script\b[\s\S]*?<\/script\s*>/giu, " ").replace(/<style\b[\s\S]*?<\/style\s*>/giu, " ").replace(/<[^>]*>/gu, " ");
  return (visible.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []).length;
}

function jsonLdTypes(html: string): string[] {
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script\s*>/giu);
  const types = new Set<string>();
  for (const script of scripts) {
    try {
      const value: unknown = JSON.parse(script[2] ?? "");
      const visit = (item: unknown): void => {
        if (Array.isArray(item)) { item.forEach(visit); return; }
        if (typeof item !== "object" || item === null) return;
        const type = (item as Record<string, unknown>)["@type"];
        if (typeof type === "string") types.add(type);
        else if (Array.isArray(type)) type.filter((entry): entry is string => typeof entry === "string").forEach((entry) => types.add(entry));
        if ("@graph" in item) visit((item as Record<string, unknown>)["@graph"]);
      };
      visit(value);
    } catch { /* malformed JSON-LD is reported as having no discovered types */ }
  }
  return [...types].sort();
}

async function statusOf(fetcher: Fetcher, url: URL): Promise<number | null> {
  try { return (await fetcher(url)).status; } catch { return null; }
}

/** Checks one URL using an injected safe fetcher so offline tests never access the network. */
export async function auditUrl(input: string, fetcher: Fetcher = safeFetch) {
  const started = Date.now();
  const response = await fetcher(input);
  const html = await response.text();
  const elapsedMs = Date.now() - started;
  const finalUrl = new URL(response.url || input);
  const origin = finalUrl.origin;
  const [robotsResponse, sitemapStatus, llmsStatus] = await Promise.all([
    fetcher(new URL("/robots.txt", origin)).catch(() => null),
    statusOf(fetcher, new URL("/sitemap.xml", origin)),
    statusOf(fetcher, new URL("/llms.txt", origin)),
  ]);
  const robotsAvailable = Boolean(robotsResponse && (robotsResponse.ok || robotsResponse.status === 404));
  const robots = robotsResponse?.ok ? await robotsResponse.text() : "";
  const blocked = robotsAvailable ? AI_BOTS.filter((bot) => isBlockedFor(robots, bot)) : [...AI_BOTS];
  const description = /<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["'][^"']+["']/iu.test(html)
    || /<meta\b[^>]*content\s*=\s*["'][^"']+["'][^>]*name\s*=\s*["']description["']/iu.test(html);
  const canonical = /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["'][^"']+["']/iu.test(html)
    || /<link\b[^>]*href\s*=\s*["'][^"']+["'][^>]*rel\s*=\s*["']canonical["']/iu.test(html);
  const title = /<title\b[^>]*>\s*[^<]+\s*<\/title\s*>/iu.test(html);
  const h1Count = (html.match(/<h1\b[^>]*>/giu) ?? []).length;
  const h2Count = (html.match(/<h2\b[^>]*>/giu) ?? []).length;
  const types = jsonLdTypes(html);
  const noIndex = /<meta\b[^>]*name\s*=\s*["'](?:robots|googlebot)["'][^>]*content\s*=\s*["'][^"']*noindex[^"']*["']/iu.test(html)
    || /<meta\b[^>]*content\s*=\s*["'][^"']*noindex[^"']*["'][^>]*name\s*=\s*["'](?:robots|googlebot)["']/iu.test(html)
    || /(?:^|,)\s*noindex\b/iu.test(response.headers.get("x-robots-tag") ?? "");
  const checks: CrawlCheck[] = [
    { id: "status", ok: response.status === 200, pts: 10, detail: `HTTP ${response.status}`, fix: "Check that the page is published and returns HTTP 200 to visitors." },
    { id: "speed", ok: elapsedMs < 1500, pts: 10, detail: `${elapsedMs} ms`, fix: "Review server response time and caching; this is a lightweight response-time check." },
    { id: "robots", ok: blocked.length === 0, pts: 20, detail: robotsResponse?.ok ? blocked.length ? `Blocked: ${blocked.join(", ")}` : "robots.txt does not block the checked AI crawlers" : robotsResponse?.status === 404 ? "No robots.txt restrictions detected (HTTP 404)" : "robots.txt unavailable; bot access could not be confirmed", fix: "Review robots.txt and allow the AI crawlers you want to reach this page. Blocking can be intentional; choose per bot." },
    { id: "noindex", ok: !noIndex, pts: 10, detail: noIndex ? "A robots directive contains noindex" : "No noindex directive detected", fix: "If indexing is intended, remove the noindex directive from the page or response headers." },
    { id: "content", ok: countWords(html) >= 150, pts: 15, detail: `${countWords(html)} words outside scripts and styles`, fix: "Include at least 150 words of useful content in the initial HTML response." },
    { id: "metadata", ok: title && description && canonical, pts: 10, detail: `Title ${title ? "present" : "missing"} · description ${description ? "present" : "missing"} · canonical ${canonical ? "present" : "missing"}`, fix: "Add a descriptive title, meta description, and canonical link to the page head." },
    { id: "headings", ok: h1Count === 1 && h2Count >= 2, pts: 5, detail: `${h1Count} H1 · ${h2Count} H2`, fix: "Use exactly one H1 and at least two descriptive H2 headings." },
    { id: "jsonld", ok: types.length > 0, pts: 10, detail: types.length ? `JSON-LD types: ${types.join(", ")}` : "No valid JSON-LD types detected", fix: "Add accurate schema.org JSON-LD that describes the page, such as Organization, Product, or FAQPage where applicable." },
    { id: "sitemap", ok: sitemapStatus === 200, pts: 5, detail: sitemapStatus === null ? "sitemap.xml unavailable" : `HTTP ${sitemapStatus}`, fix: "Publish a sitemap.xml that returns HTTP 200 and lists canonical pages." },
    { id: "llms", ok: llmsStatus === 200, pts: 5, detail: llmsStatus === null ? "llms.txt unavailable" : `HTTP ${llmsStatus}`, fix: "If useful for your project, publish an llms.txt file. It is an optional convention and does not guarantee citations." },
  ];
  return { url: finalUrl.toString(), score: checks.reduce((sum, check) => sum + (check.ok ? check.pts : 0), 0), elapsedMs, checks };
}

type AppDatabase = typeof db;
export function getCrawlAuditHistory(brandId: string, database: AppDatabase = db) {
  return database.select({ id: crawlAudits.id, url: crawlAudits.url, score: crawlAudits.score, createdAt: crawlAudits.createdAt })
    .from(crawlAudits).where(eq(crawlAudits.brandId, brandId)).orderBy(desc(crawlAudits.createdAt), sql`rowid DESC`).limit(30).all()
    .map((row) => ({ ...row, score: row.score ?? 0, createdAt: row.createdAt ?? "" }));
}

export async function auditAndSave(brandId: string, url: string, fetcher: Fetcher = safeFetch, database: Database.Database = getSqlite()) {
  const result = await auditUrl(url, fetcher);
  const latest = database.prepare("SELECT score FROM crawl_audits WHERE brand_id = @brandId ORDER BY created_at DESC, rowid DESC LIMIT 1").get({ brandId }) as { score: number | null } | undefined;
  const id = randomUUID();
  database.prepare(`INSERT INTO crawl_audits (id, brand_id, url, result, score) VALUES (@id, @brandId, @url, @result, @score)`)
    .run({ id, brandId, url: result.url, result: JSON.stringify(result), score: result.score });
  const saved = database.prepare("SELECT created_at AS createdAt FROM crawl_audits WHERE id = @id").get({ id }) as { createdAt: string | null };
  return { ...result, previousScore: latest?.score ?? null, delta: latest?.score == null ? null : result.score - latest.score, history: { id, url: result.url, score: result.score, createdAt: saved.createdAt ?? "" } };
}
