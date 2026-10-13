import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import Database from "better-sqlite3";
import { getSqlite } from "@/db";
import { createThrottle, withRetry } from "@/lib/providers/throttle";
import { getProviders } from "@/lib/providers/registry";
import { createMockProvider } from "@/lib/providers/mock";
import type { AIProvider } from "@/lib/providers/types";
import { detectBrands } from "@/lib/analysis/mentions";
import { scoreSentiment, type SentimentLabel } from "@/lib/analysis/sentiment";
import { extractCitations } from "@/lib/analysis/citations";
import { toSqlTime } from "@/lib/time";

const WINDOW_LIMIT = 5;
const DAILY_LIMIT = 200;
const SAMPLE_COUNT = 3;
const CACHE_HOURS = 24;

export type PublicCheckInput = { brand: string; question: string };
export type PublicCheckSample = {
  answer: string;
  mentioned: boolean;
  position: number | null;
  sentiment: SentimentLabel | null;
  citedDomains: string[];
};
export type PublicCheckResult = {
  mentionedCount: number;
  sampleSize: number;
  averagePosition: number | null;
  sentiment: { positive: number; neutral: number; negative: number; n: number };
  topSources: Array<{ domain: string; answers: number }>;
  otherNames: string[];
  variability: { mentionsMin: number; mentionsMax: number; positionMin: number | null; positionMax: number | null };
  samples: PublicCheckSample[];
  simulated: boolean;
};

export type PublicCheckLimit = "allowed" | "ip_limit" | "daily_limit";

function utcDayStart(now: Date): string {
  return toSqlTime(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
}

/** Reserve one check atomically; logs contain only the caller IP and timestamp. */
export function reservePublicCheck(ip: string, database: Database.Database = getSqlite(), now = new Date()): PublicCheckLimit {
  if (isIP(ip) === 0) return "ip_limit";
  const sinceHour = toSqlTime(new Date(now.getTime() - 60 * 60_000));
  const dayStart = utcDayStart(now);
  return database.transaction((): PublicCheckLimit => {
    database.prepare("DELETE FROM public_check_log WHERE created_at < @retentionCutoff")
      .run({ retentionCutoff: toSqlTime(new Date(now.getTime() - 30 * 24 * 60 * 60_000)) });
    const ipCount = database.prepare("SELECT COUNT(*) AS count FROM public_check_log WHERE ip = @ip AND created_at >= @since")
      .get({ ip, since: sinceHour }) as { count: number };
    if (ipCount.count >= WINDOW_LIMIT) return "ip_limit";
    const dailyCount = database.prepare("SELECT COUNT(*) AS count FROM public_check_log WHERE created_at >= @dayStart")
      .get({ dayStart }) as { count: number };
    if (dailyCount.count >= DAILY_LIMIT) return "daily_limit";
    database.prepare("INSERT INTO public_check_log (id, ip) VALUES (@id, @ip)")
      .run({ id: randomUUID(), ip });
    return "allowed";
  })();
}

function cacheKey(input: PublicCheckInput): string {
  return createHash("sha256").update(JSON.stringify([input.brand.trim().toLocaleLowerCase("en"), input.question.trim().toLocaleLowerCase("en")])).digest("hex");
}

function getCachedResult(key: string, database: Database.Database, now: Date): PublicCheckResult | null {
  const since = toSqlTime(new Date(now.getTime() - CACHE_HOURS * 60 * 60_000));
  const row = database.prepare("SELECT result FROM public_check_cache WHERE cache_key = @key AND created_at >= @since")
    .get({ key, since }) as { result: string } | undefined;
  if (!row) return null;
  try {
    const value: unknown = JSON.parse(row.result);
    if (typeof value === "object" && value !== null && "samples" in value && Array.isArray(value.samples)) return value as PublicCheckResult;
  } catch { /* replace a corrupt cache row with a fresh result */ }
  database.prepare("DELETE FROM public_check_cache WHERE cache_key = @key").run({ key });
  return null;
}

function providerForCheck(): AIProvider {
  const configured = getProviders().find((provider) => !provider.isMock);
  return configured ?? createMockProvider("public-check-demo", "Public checker demo");
}

const genericNames = new Set(["A", "An", "And", "As", "At", "But", "For", "From", "Great", "Here", "How", "If", "In", "It", "Many", "Most", "Our", "Several", "The", "This", "To", "We", "What", "When", "Where", "With", "You"]);

function otherNamesIn(answer: string, brand: string): string[] {
  const own = brand.trim().toLocaleLowerCase("en");
  const names = new Set<string>();
  for (const match of answer.matchAll(/\b[A-Z][\p{L}\p{N}&+.-]*(?:\s+[A-Z][\p{L}\p{N}&+.-]*){0,2}/gu)) {
    const name = match[0].trim();
    const firstWord = name.split(/\s+/u)[0] ?? "";
    if (name.length < 2 || genericNames.has(firstWord) || name.toLocaleLowerCase("en") === own) continue;
    names.add(name);
  }
  return [...names].slice(0, 8);
}

function analyzeSamples(brand: string, answers: string[], simulated: boolean): PublicCheckResult {
  const rivals = [...new Set(answers.flatMap((answer) => otherNamesIn(answer, brand)))];
  const refs = [{ id: "target-brand", name: brand }, ...rivals.map((name, index) => ({ id: `other-${index}`, name }))];
  const samples = answers.map((answer): PublicCheckSample => {
    const found = detectBrands(answer, refs);
    const hit = found.find((item) => item.brandId === "target-brand");
    const sentiment = hit ? scoreSentiment(answer, hit.index) : null;
    return {
      answer,
      mentioned: Boolean(hit),
      position: hit?.position ?? null,
      sentiment: sentiment?.label ?? null,
      citedDomains: extractCitations(answer).map(({ domain }) => domain),
    };
  });
  const positions = samples.flatMap((sample) => sample.position === null ? [] : [sample.position]);
  const scored = samples.flatMap((sample) => sample.sentiment ? [sample.sentiment] : []);
  const domainCounts = new Map<string, number>();
  for (const sample of samples) for (const domain of sample.citedDomains) domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  return {
    mentionedCount: samples.filter((sample) => sample.mentioned).length,
    sampleSize: samples.length,
    averagePosition: positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : null,
    sentiment: {
      positive: scored.filter((value) => value === "positive").length,
      neutral: scored.filter((value) => value === "neutral").length,
      negative: scored.filter((value) => value === "negative").length,
      n: scored.length,
    },
    topSources: [...domainCounts.entries()].map(([domain, answersCount]) => ({ domain, answers: answersCount }))
      .sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain)).slice(0, 5),
    otherNames: rivals.slice(0, 5),
    variability: {
      mentionsMin: samples.length > 0 && samples.every((sample) => sample.mentioned) ? 1 : 0,
      mentionsMax: samples.some((sample) => sample.mentioned) ? 1 : 0,
      positionMin: positions.length ? Math.min(...positions) : null,
      positionMax: positions.length ? Math.max(...positions) : null,
    },
    samples,
    simulated,
  };
}

export class PublicCheckError extends Error {
  constructor(readonly reason: PublicCheckLimit | "provider_failed") {
    super(reason);
    this.name = "PublicCheckError";
  }
}

export async function runPublicCheck(
  input: PublicCheckInput,
  ip: string,
  options: {
    database?: Database.Database;
    provider?: AIProvider;
    now?: Date;
    throttle?: (providerId: string) => Promise<void>;
    retry?: <T>(operation: () => Promise<T>) => Promise<T>;
  } = {},
): Promise<PublicCheckResult> {
  const database = options.database ?? getSqlite();
  const now = options.now ?? new Date();
  const limit = reservePublicCheck(ip, database, now);
  if (limit !== "allowed") throw new PublicCheckError(limit);
  const key = cacheKey(input);
  const cached = getCachedResult(key, database, now);
  if (cached) return cached;
  const provider = options.provider ?? providerForCheck();
  const throttle = options.throttle ?? createThrottle(2_200);
  const retry = options.retry ?? withRetry;
  const answers: string[] = [];
  try {
    for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
      answers.push(await retry(async () => {
        if (!provider.isMock) await throttle(provider.id);
        return provider.run(input.question, { brandName: input.brand });
      }));
    }
  } catch {
    if (answers.length === 0) throw new PublicCheckError("provider_failed");
  }
  const result = analyzeSamples(input.brand, answers, provider.isMock);
  database.prepare(`INSERT INTO public_check_cache (cache_key, result) VALUES (@key, @result)
    ON CONFLICT(cache_key) DO UPDATE SET result = excluded.result, created_at = CURRENT_TIMESTAMP`)
    .run({ key, result: JSON.stringify(result) });
  return result;
}
