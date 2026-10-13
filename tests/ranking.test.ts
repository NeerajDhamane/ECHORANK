import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { brands, chats, prompts, schema, trackingRuns } from "@/db/schema";
import { getRanking } from "@/lib/ranking";

describe("brand ranking", () => {
  let connection: Database.Database | undefined;
  afterEach(() => { connection?.close(); connection = undefined; });
  it("compares equal windows and computes sentiment and rank per found brand", () => {
    connection = new Database(":memory:"); migrateDatabase(connection);
    const db = drizzle(connection, { schema });
    db.insert(brands).values([{ id: "own", userId: "u", name: "Own" }, { id: "rival", userId: "u", ownerBrandId: "own", name: "Rival" }, { id: "quiet", userId: "u", ownerBrandId: "own", name: "Quiet" }]).run();
    db.insert(prompts).values({ id: "p", brandId: "own", text: "Prompt" }).run();
    const days = ["08", "09", "10", "11"];
    db.insert(trackingRuns).values(days.map((day) => ({ id: `r${day}`, brandId: "own", startedAt: `2026-10-${day} 12:00:00`, status: "completed" }))).run();
    const hit = (brandId: string, position: number, sentimentScore: number) => ({ brandId, name: brandId, position, sentimentScore });
    const rows = [
      { id: "old1", day: "08", hits: [hit("own", 2, 0), hit("rival", 1, 1)] },
      { id: "old2", day: "09", hits: [hit("rival", 2, -1)] },
      { id: "new1", day: "10", hits: [hit("own", 1, 1)] },
      { id: "new2", day: "11", hits: [hit("own", 3, -1), hit("rival", 2, 0)] },
      { id: "new3", day: "11", hits: [] },
    ];
    db.insert(chats).values(rows.map(({ id, day, hits }) => ({ id, runId: `r${day}`, promptId: "p", brandId: "own", platform: "ChatGPT", createdAt: `2026-10-${day} 12:00:00`, mentioned: hits.some((item) => item.brandId === "own") ? 1 : 0, position: hits.find((item) => item.brandId === "own")?.position ?? null, sentiment: null, brandsFound: JSON.stringify(hits) }))).run();
    const result = getRanking({ brandId: "own", dateFrom: "2026-10-10", dateTo: "2026-10-11" }, connection);
    expect(result.sampleSize).toBe(3);
    expect(result.previousSampleSize).toBe(2);
    expect(result.previousWindow).toEqual({ dateFrom: "2026-10-08T00:00:00.000Z", dateTo: "2026-10-09T23:59:59.000Z" });
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ brandId: "own", mentions: 2, sentiment: 50, sentimentN: 2, averageRank: 2, previousMentions: 1 });
    expect(result.items[0]?.visibility).toBeCloseTo(200 / 3);
    expect(result.items[0]?.delta).toBeCloseTo(50 / 3);
    expect(result.items[1]).toMatchObject({ brandId: "rival", mentions: 1, sentiment: 50, sentimentN: 1, averageRank: 2, previousMentions: 2 });
    expect(result.items[1]?.visibility).toBeCloseTo(100 / 3);
    expect(result.items[1]?.delta).toBeCloseTo(-200 / 3);
    expect(result.items[2]).toMatchObject({ brandId: "quiet", mentions: 0, delta: 0, sentiment: null, averageRank: null });
  });
  it("returns n/a delta when the preceding window has no answers", () => {
    connection = new Database(":memory:"); migrateDatabase(connection);
    const db = drizzle(connection, { schema });
    db.insert(brands).values({ id: "own", userId: "u", name: "Own" }).run();
    db.insert(prompts).values({ id: "p", brandId: "own", text: "Prompt" }).run();
    db.insert(trackingRuns).values({ id: "r", brandId: "own", startedAt: "2026-10-11 12:00:00", status: "completed" }).run();
    db.insert(chats).values({ id: "c", runId: "r", promptId: "p", brandId: "own", platform: "A", createdAt: "2026-10-11 12:00:00", mentioned: 0, brandsFound: "[]" }).run();
    expect(getRanking({ brandId: "own", dateFrom: "2026-10-10", dateTo: "2026-10-11" }, connection).items[0]?.delta).toBeNull();
  });
});
