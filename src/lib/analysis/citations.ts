import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

export type SourceType = "review" | "forum" | "social" | "news" | "reference" | "docs" | "own" | "other";
export type Citation = { domain: string; url: string | null };

const URL_PATTERN = /https?:\/\/[^\s<>{}\[\]"']+/giu;
const DOMAIN_PATTERN = /(?<![\p{L}\p{N}@_-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,}(?::\d{1,5})?(?:\/[^\s<>{}\[\]"']*)?/giu;
const TRAILING_PUNCTUATION = /[.,!?;:)]*$/u;

function trimCitation(value: string): string {
  return value.replace(TRAILING_PUNCTUATION, "");
}

function parseCitation(value: string): Citation | null {
  const candidate = trimCitation(value);
  try {
    const parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    const domain = parsed.hostname.toLowerCase().replace(/^www\./u, "");
    if (!domain.includes(".") || domain.endsWith(".")) return null;
    return { domain, url: candidate.includes("://") ? `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}` : null };
  } catch {
    return null;
  }
}

/** Extract unique cited domains, collapsing full URLs and bare-domain mentions. */
export function extractCitations(text: string): Citation[] {
  const found = new Map<string, Citation>();
  const urlRanges: Array<[number, number]> = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const value = match[0];
    const start = match.index ?? 0;
    urlRanges.push([start, start + value.length]);
    const citation = parseCitation(value);
    if (citation && !found.has(citation.domain)) found.set(citation.domain, citation);
  }

  for (const match of text.matchAll(DOMAIN_PATTERN)) {
    const start = match.index ?? 0;
    if (urlRanges.some(([left, right]) => start >= left && start < right)) continue;
    const citation = parseCitation(match[0]);
    if (citation && !found.has(citation.domain)) found.set(citation.domain, citation);
  }
  return [...found.values()];
}

function normalizeDomain(value: string): string | null {
  return parseCitation(value)?.domain ?? null;
}

function isDomainOrSubdomain(domain: string, root: string): boolean {
  return domain === root || domain.endsWith(`.${root}`);
}

/** Classify a normalized domain, optionally marking a user's own domains. */
export function classifyDomain(domain: string, ownDomains: string[] = []): SourceType {
  const normalized = normalizeDomain(domain);
  if (!normalized) return "other";
  const own = ownDomains.map(normalizeDomain).filter((entry): entry is string => entry !== null);
  if (own.some((root) => isDomainOrSubdomain(normalized, root))) return "own";
  if (/^(docs|developer|developers|api)\./u.test(normalized) || isDomainOrSubdomain(normalized, "readthedocs.io")) return "docs";
  if (["reddit.com", "stackexchange.com", "stackoverflow.com", "quora.com", "discourse.org"].some((root) => isDomainOrSubdomain(normalized, root))) return "forum";
  if (["x.com", "twitter.com", "facebook.com", "linkedin.com", "instagram.com", "tiktok.com", "youtube.com"].some((root) => isDomainOrSubdomain(normalized, root))) return "social";
  if (["trustpilot.com", "g2.com", "capterra.com", "yelp.com", "sitejabber.com"].some((root) => isDomainOrSubdomain(normalized, root))) return "review";
  if (["wikipedia.org", "britannica.com", "wikidata.org"].some((root) => isDomainOrSubdomain(normalized, root))) return "reference";
  if (["reuters.com", "apnews.com", "bbc.com", "nytimes.com", "theguardian.com"].some((root) => isDomainOrSubdomain(normalized, root))) return "news";
  return "other";
}

/** Persist the unique source-domain links for one chat. Repeated calls are idempotent. */
export function persistSources(
  database: Database.Database,
  chatId: string,
  citations: Citation[],
  ownDomains: string[] = [],
): void {
  const insertSource = database.prepare(`
    INSERT INTO sources (id, domain, type) VALUES (@id, @domain, @type)
    ON CONFLICT(domain) DO NOTHING
  `);
  const selectSource = database.prepare("SELECT id FROM sources WHERE domain = @domain");
  const insertChatSource = database.prepare(`
    INSERT INTO chat_sources (chat_id, source_id, citation_count) VALUES (@chatId, @sourceId, 1)
    ON CONFLICT(chat_id, source_id) DO NOTHING
  `);

  const persist = database.transaction((items: Citation[]) => {
    for (const item of items) {
      const domain = normalizeDomain(item.domain);
      if (!domain) continue;
      insertSource.run({ id: randomUUID(), domain, type: classifyDomain(domain, ownDomains) });
      const source = selectSource.get({ domain }) as { id: string } | undefined;
      if (source) insertChatSource.run({ chatId, sourceId: source.id });
    }
  });
  persist(citations);
}
