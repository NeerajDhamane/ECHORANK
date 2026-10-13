import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { brands, chats, chatSources, prompts, schema, sources, tags, promptTags, trackingRuns } from "@/db/schema";
import { getOverview, sentimentBreakdown, shareOfVoice, topSources, visibilityByPlatform, visibilityByRun, whereClause } from "@/lib/analytics";

describe("analytics scope and metrics", () => {
  let connection: Database.Database | undefined;

  afterEach(() => {
    connection?.close();
    connection = undefined;
  });

  function setup() {
    connection = new Database(":memory:");
    migrateDatabase(connection);
    const database = drizzle(connection, { schema });
    database.insert(brands).values([
      { id: "own", userId: "user", name: "Own Brand" },
      { id: "rival", userId: "user", ownerBrandId: "own", name: "Rival" },
    ]).run();
    database.insert(prompts).values([
      { id: "p1", brandId: "own", text: "Prompt one", locale: "en-US" },
      { id: "p2", brandId: "own", text: "Prompt two", locale: "global" },
    ]).run();
    database.insert(tags).values({ id: "tag-1", userId: "user", name: "priority" }).run();
    database.insert(promptTags).values({ promptId: "p1", tagId: "tag-1" }).run();
    database.insert(trackingRuns).values([
      { id: "r1", brandId: "own", startedAt: "2026-10-14 00:00:00", status: "completed" },
      { id: "r2", brandId: "own", startedAt: "2026-10-15 00:00:00", status: "completed" },
    ]).run();
    const found = (ids: Array<[string, string]>) => JSON.stringify(ids.map(([brandId, name], index) => ({ brandId, name, position: index + 1 })));
    const rows = [
      { id: "c1", runId: "r1", promptId: "p1", brandId: "own", platform: "A", createdAt: "2026-10-14 08:00:00", isSimulated: 0, mentioned: 1, position: 1, sentiment: "positive", sentimentScore: 0.5, brandsFound: found([["own", "Own Brand"], ["rival", "Rival"]]) },
      { id: "c2", runId: "r1", promptId: "p2", brandId: "own", platform: "B", createdAt: "2026-10-14 23:59:59", isSimulated: 0, mentioned: 0, brandsFound: found([["rival", "Rival"]]) },
      { id: "c3", runId: "r1", promptId: "p1", brandId: "own", platform: "A", createdAt: "2026-10-14 12:00:00", isSimulated: 1, mentioned: 1, position: 2, sentiment: "negative", sentimentScore: -0.5, brandsFound: found([["own", "Own Brand"], ["rival", "Rival"]]) },
      { id: "c4", runId: "r1", promptId: "p1", brandId: "own", platform: "A", createdAt: "2026-10-14 13:00:00", isSimulated: 0, mentioned: 1, sentiment: "positive", sentimentScore: 1, error: "Provider request failed.", brandsFound: found([["own", "Own Brand"]]) },
      { id: "c5", runId: "r2", promptId: "p1", brandId: "own", platform: "A", createdAt: "2026-10-15 00:00:00", isSimulated: 0, mentioned: 0, brandsFound: "[]" },
    ];
    database.insert(chats).values(rows).run();
    database.insert(sources).values([
      { id: "s-docs", domain: "docs.example", type: "docs" },
      { id: "s-forum", domain: "forum.example", type: "forum" },
    ]).run();
    database.insert(chatSources).values([
      { chatId: "c1", sourceId: "s-docs", citationCount: 2 },
      { chatId: "c2", sourceId: "s-forum", citationCount: 1 },
      { chatId: "c3", sourceId: "s-docs", citationCount: 1 },
      { chatId: "c4", sourceId: "s-forum", citationCount: 1 },
    ]).run();
    return connection;
  }

  it("builds named, injection-safe scope predicates and includes a date-only end day", () => {
    const where = whereClause({ brandId: "own", dateFrom: "2026-10-14", dateTo: "2026-10-14", platform: "A", tagId: "tag-1" });
    expect(where.sql).toContain("c.created_at >= @dateFrom");
    expect(where.sql).toContain("c.created_at < @dateTo");
    expect(where.sql).toContain("EXISTS (SELECT 1 FROM prompt_tags");
    expect(where.params).toMatchObject({ brandId: "own", dateFrom: "2026-10-14 00:00:00", dateTo: "2026-10-15 00:00:00", platform: "A", tagId: "tag-1" });
  });

  it("computes trend, sentiment, platform visibility, share of voice, and sources by hand", () => {
    const db = setup();
    const scope = { brandId: "own", dateFrom: "2026-10-14", dateTo: "2026-10-14" };
    expect(visibilityByRun(scope, db)).toEqual([{
      runId: "r1", startedAt: "2026-10-14 00:00:00", sampleSize: 2,
      brands: [
        { brandId: "own", name: "Own Brand", mentions: 1, visibility: 0.5 },
        { brandId: "rival", name: "Rival", mentions: 2, visibility: 1 },
      ],
    }]);
    expect(sentimentBreakdown(scope, db)).toEqual({ n: 1, positive: 1, neutral: 0, negative: 0, averageScore: 75 });
    expect(visibilityByPlatform(scope, db)).toEqual([
      { platform: "A", sampleSize: 1, mentions: 1, visibility: 1, averageRank: 1 },
      { platform: "B", sampleSize: 1, mentions: 0, visibility: 0, averageRank: null },
    ]);
    expect(shareOfVoice(scope, db)).toEqual([
      { brandId: "own", name: "Own Brand", mentions: 1, sampleSize: 2, share: 0.5 },
      { brandId: "rival", name: "Rival", mentions: 2, sampleSize: 2, share: 1 },
    ]);
    expect(topSources(scope, 10, db)).toEqual([
      { domain: "docs.example", type: "docs", answers: 1, citations: 2 },
      { domain: "forum.example", type: "forum", answers: 1, citations: 1 },
    ]);
    expect(getOverview(scope, db)).toMatchObject({
      stats: { visibility: 50, visibilityN: 2, averageRank: 1, rankN: 1, positiveSentiment: 100, sentimentN: 1, answers: 2 },
      sources: [
        { domain: "docs.example", usedPercent: 50, averageCitations: 2 },
        { domain: "forum.example", usedPercent: 50, averageCitations: 1 },
      ],
      recentChats: [
        { id: "c2", promptId: "p2", platform: "B", mentioned: 0 },
        { id: "c1", promptId: "p1", platform: "A", mentioned: 1 },
      ],
      simulatedIncluded: false,
    });
  });

  it("excludes simulated answers by default, supports tag scope, and handles inclusive same-day dates", () => {
    const db = setup();
    expect(shareOfVoice({ brandId: "own" }, db)[0]?.sampleSize).toBe(3);
    expect(shareOfVoice({ brandId: "own", includeSimulated: true }, db)[0]?.sampleSize).toBe(4);
    expect(shareOfVoice({ brandId: "own", tagId: "tag-1" }, db)[0]?.sampleSize).toBe(2);
    const allRuns = visibilityByRun({ brandId: "own", includeSimulated: true }, db);
    expect(allRuns.map(({ runId, sampleSize }) => [runId, sampleSize])).toEqual([["r1", 3], ["r2", 1]]);
  });
});
