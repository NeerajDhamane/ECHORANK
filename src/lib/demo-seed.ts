import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { and, eq, isNull } from "drizzle-orm";
import { db, getSqlite } from "@/db";
import { brands, chats, prompts, topics, trackingRuns, users } from "@/db/schema";
import { detectBrands } from "@/lib/analysis/mentions";
import { scoreSentiment } from "@/lib/analysis/sentiment";
import { extractCitations, persistSources } from "@/lib/analysis/citations";
import { hashPassword } from "@/lib/auth";
import { toSqlTime } from "@/lib/time";

type AppDatabase = typeof db;
const DEMO_EMAIL = "demo@echorank.local";
const DEMO_PASSWORD = "demo1234";
const DEMO_WEBSITE = "https://acmecloud.example";
const PLATFORM_LABELS = ["ChatGPT (simulated)", "Perplexity (simulated)", "Google AI (simulated)"];
const RUN_DAY_OFFSETS = [14, 11, 8, 5, 2, 0];
const OWN_MENTION_COUNTS = [3, 6, 9, 12, 15, 18];
const COMPETITOR_NAMES = ["Cloudflare", "DigitalOcean", "Linode", "Render"];
const TOPIC_NAMES = ["Reliability", "Pricing", "Getting started"];
const PROMPT_TEXTS = [
  ["Which cloud hosting provider is most reliable for a small business?", "How do cloud hosts handle uptime and incident response?", "Which provider has the clearest reliability track record?", "What should a small company compare when evaluating cloud uptime?"],
  ["What is an affordable cloud hosting option for a growing company?", "How should I compare cloud hosting plans and pricing?", "Which cloud provider offers predictable costs for a startup?"],
  ["How can a team get started moving a small app to cloud hosting?", "Which cloud host is easiest for a small team to manage?", "What should a first-time cloud hosting customer look for?"]
].flat();

export type SeedResult = {
  userId: string;
  brandId: string;
  prompts: number;
  runs: number;
  chats: number;
  reset: boolean;
};

function demoIds(brandId: string) {
  return {
    topic: (index: number) => `${brandId}-topic-${String(index + 1).padStart(2, "0")}`,
    prompt: (index: number) => `${brandId}-prompt-${String(index + 1).padStart(2, "0")}`,
    competitor: (index: number) => `${brandId}-competitor-${String(index + 1).padStart(2, "0")}`,
    run: (index: number) => `${brandId}-run-${String(index + 1).padStart(2, "0")}`,
    chat: (runIndex: number, promptIndex: number, providerIndex: number) =>
      `${brandId}-chat-${String(runIndex + 1).padStart(2, "0")}-${String(promptIndex + 1).padStart(2, "0")}-${String(providerIndex + 1).padStart(2, "0")}`,
  };
}

/** Seed a demo account and historical runs using the same analysis functions as tracking. */
export async function seedDemoData(
  database: AppDatabase = db,
  options: { reset?: boolean; hashPasswordFn?: (password: string) => Promise<string>; sourceDatabase?: Database.Database } = {},
): Promise<SeedResult> {
  const reset = options.reset ?? false;
  const encodedPassword = await (options.hashPasswordFn ?? hashPassword)(DEMO_PASSWORD);
  let user = database.select().from(users).where(eq(users.email, DEMO_EMAIL)).get();
  if (!user) {
    user = database.insert(users).values({
      id: "demo-user", name: "EchoRank Demo", email: DEMO_EMAIL, passwordHash: encodedPassword,
    }).onConflictDoNothing().returning().get();
    user ??= database.select().from(users).where(eq(users.email, DEMO_EMAIL)).get();
  } else {
    database.update(users).set({ name: "EchoRank Demo", passwordHash: encodedPassword }).where(eq(users.id, user.id)).run();
    user = database.select().from(users).where(eq(users.id, user.id)).get();
  }
  if (!user) throw new Error("Unable to create demo user.");

  let brand = database.select().from(brands).where(and(
    eq(brands.userId, user.id), eq(brands.name, "Acme Cloud"), eq(brands.website, DEMO_WEBSITE),
    isNull(brands.ownerBrandId), isNull(brands.deletedAt),
  )).get();
  if (reset && brand) {
    database.update(prompts).set({ deletedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
      .where(and(eq(prompts.brandId, brand.id), isNull(prompts.deletedAt))).run();
    database.update(brands).set({ deletedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
      .where(and(eq(brands.ownerBrandId, brand.id), isNull(brands.deletedAt))).run();
    database.update(brands).set({ deletedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
      .where(and(eq(brands.id, brand.id), isNull(brands.deletedAt))).run();
    brand = undefined;
  }

  if (!brand) {
    const brandId = reset ? randomUUID() : "demo-brand-acme-cloud";
    brand = database.insert(brands).values({
      id: brandId, userId: user.id, ownerBrandId: null, name: "Acme Cloud", aliases: JSON.stringify(["Acme Hosting"]),
      website: DEMO_WEBSITE, industry: "cloud hosting", autoTrack: 0, trackFrequency: "daily",
    }).onConflictDoNothing().returning().get();
    brand ??= database.select().from(brands).where(and(
      eq(brands.userId, user.id), eq(brands.name, "Acme Cloud"), eq(brands.website, DEMO_WEBSITE),
      isNull(brands.ownerBrandId), isNull(brands.deletedAt),
    )).get();
  }
  if (!brand) throw new Error("Unable to create demo brand.");

  const ids = demoIds(brand.id);
  const brandId = brand.id;
  const brandAliases = JSON.parse(brand.aliases ?? "[]") as string[];
  const competitors: Array<{ id: string; name: string; aliases: string[] }> = [];
  for (const [index, name] of COMPETITOR_NAMES.entries()) {
    const id = ids.competitor(index);
    let competitor = database.select().from(brands).where(and(
      eq(brands.id, id), eq(brands.ownerBrandId, brandId), isNull(brands.deletedAt),
    )).get();
    if (!competitor) {
      competitor = database.insert(brands).values({
        id, userId: user.id, ownerBrandId: brandId, name, aliases: "[]", website: null, industry: null,
      }).onConflictDoNothing().returning().get();
      competitor ??= database.select().from(brands).where(and(
        eq(brands.id, id), eq(brands.ownerBrandId, brandId), isNull(brands.deletedAt),
      )).get();
    }
    if (competitor) competitors.push({ id: competitor.id, name: competitor.name, aliases: [] });
  }

  for (const [index, name] of TOPIC_NAMES.entries()) {
    const id = ids.topic(index);
    let topic = database.select().from(topics).where(eq(topics.id, id)).get();
    if (!topic) topic = database.insert(topics).values({ id, brandId, name }).onConflictDoNothing().returning().get();
    topic ??= database.select().from(topics).where(eq(topics.id, id)).get();
  }

  const promptRows = [];
  for (const [index, text] of PROMPT_TEXTS.entries()) {
    const id = ids.prompt(index);
    let prompt = database.select().from(prompts).where(eq(prompts.id, id)).get();
    if (!prompt) {
      prompt = database.insert(prompts).values({
        id, brandId, topicId: ids.topic(index < 4 ? 0 : index < 7 ? 1 : 2), text,
        status: "active", locale: "global",
      }).onConflictDoNothing().returning().get();
      prompt ??= database.select().from(prompts).where(eq(prompts.id, id)).get();
    }
    if (prompt && !prompt.deletedAt) promptRows.push(prompt);
  }

  const brandRefs = [{ id: brandId, name: brand.name, aliases: brandAliases }, ...competitors];
  const rawDatabase = options.sourceDatabase ?? getSqlite();
  let runCount = 0;
  let chatCount = 0;
  for (const [runIndex, daysAgo] of RUN_DAY_OFFSETS.entries()) {
    const startedAt = toSqlTime(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1_000));
    const runId = ids.run(runIndex);
    const started = database.select().from(trackingRuns).where(eq(trackingRuns.id, runId)).get();
    if (!started) {
      database.insert(trackingRuns).values({
        id: runId, brandId, startedAt, finishedAt: startedAt, status: "completed", trigger: "manual",
        label: `demo-run-${runIndex + 1}`, totalExpected: promptRows.length * PLATFORM_LABELS.length,
      }).run();
    }
    runCount += 1;

    for (const [promptIndex, prompt] of promptRows.entries()) {
      for (const [providerIndex, platform] of PLATFORM_LABELS.entries()) {
        const chatId = ids.chat(runIndex, promptIndex, providerIndex);
        const existing = database.select().from(chats).where(eq(chats.id, chatId)).get();
        const mentionsOwn = (promptIndex * 3 + providerIndex * 7) % 30 < OWN_MENTION_COUNTS[runIndex];
        const mentionsCompetitor = !mentionsOwn || (promptIndex + providerIndex + runIndex) % 2 === 0;
        const competitor = competitors[(promptIndex + providerIndex + runIndex) % competitors.length];
        const isNegative = (promptIndex + providerIndex + runIndex) % 5 === 0;
        const ownSentence = isNegative
          ? "Acme Cloud is not reliable for some workloads."
          : "Acme Cloud is a reliable and useful option for cloud hosting.";
        const rivalSentence = ` ${competitor?.name ?? "DigitalOcean"} is also worth comparing.`;
        const response = `${mentionsOwn ? ownSentence : "A small business should compare uptime, support, and cost."}${mentionsCompetitor ? rivalSentence : ""} Read customer discussions at reddit.com/r/cloudhosting and technical guidance at docs.stripe.com/cloud.`;
        const hits = detectBrands(response, brandRefs);
        const found = hits.map((hit) => {
          const sentiment = scoreSentiment(response, hit.index);
          return { brandId: hit.brandId, name: hit.name, position: hit.position, sentiment: sentiment?.label ?? null, sentimentScore: sentiment?.score ?? null };
        });
        const ownHit = hits.find((hit) => hit.brandId === brandId);
        const ownSentiment = ownHit ? scoreSentiment(response, ownHit.index) : null;
        const citations = extractCitations(response);
        if (!existing) {
          database.insert(chats).values({
            id: chatId, runId, promptId: prompt.id, brandId, platform, locale: "global", isSimulated: 1,
            rawResponse: response, mentioned: ownHit ? 1 : 0, position: ownHit?.position ?? null,
            sentiment: ownSentiment?.label ?? null, sentimentScore: ownSentiment?.score ?? null,
            brandsFound: JSON.stringify(found), citedSources: JSON.stringify(citations.map(({ domain }) => domain)),
            error: null, createdAt: startedAt,
          }).run();
        }
        persistSources(rawDatabase, chatId, citations, [brand.website ?? ""]);
        chatCount += 1;
      }
    }
  }

  return { userId: user.id, brandId, prompts: promptRows.length, runs: runCount, chats: chatCount, reset };
}

export const demoCredentials = { email: DEMO_EMAIL, password: DEMO_PASSWORD } as const;
