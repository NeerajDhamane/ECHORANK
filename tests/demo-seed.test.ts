import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { brands, chats, prompts, schema, trackingRuns, users } from "@/db/schema";
import { seedDemoData } from "@/lib/demo-seed";

describe("demo seed", () => {
  let connection: Database.Database | undefined;

  afterEach(() => {
    connection?.close();
    connection = undefined;
  });

  function setup() {
    connection = new Database(":memory:");
    migrateDatabase(connection);
    return drizzle(connection, { schema });
  }

  it("seeds the requested demo data, builds an upward visibility trend, and is idempotent", async () => {
    const database = setup();
    const options = { hashPasswordFn: async () => "test-password-hash", sourceDatabase: connection };
    const first = await seedDemoData(database, options);
    expect(first).toMatchObject({ prompts: 10, runs: 6, chats: 180, reset: false });
    const trend = connection?.prepare(`
      SELECT date(started_at) AS day, SUM(mentioned) AS mentions, COUNT(*) AS n
      FROM tracking_runs JOIN chats ON chats.run_id = tracking_runs.id
      WHERE tracking_runs.brand_id = ?
      GROUP BY date(started_at) ORDER BY day
    `).all(first.brandId) as Array<{ day: string; mentions: number; n: number }>;
    expect(trend).toHaveLength(6);
    expect(trend.map(({ mentions }) => mentions)).toEqual([...trend.map(({ mentions }) => mentions)].sort((a, b) => a - b));
    expect(connection?.prepare("SELECT COUNT(*) AS count FROM chats WHERE brand_id = ? AND is_simulated = 0").get(first.brandId)).toEqual({ count: 0 });

    const second = await seedDemoData(database, options);
    expect(second.brandId).toBe(first.brandId);
    expect(database.select().from(users).all()).toHaveLength(1);
    expect(database.select().from(brands).where(eq(brands.ownerBrandId, first.brandId)).all()).toHaveLength(4);
    expect(database.select().from(prompts).where(eq(prompts.brandId, first.brandId)).all()).toHaveLength(10);
    expect(database.select().from(trackingRuns).where(eq(trackingRuns.brandId, first.brandId)).all()).toHaveLength(6);
    expect(database.select().from(chats).where(eq(chats.brandId, first.brandId)).all()).toHaveLength(180);
  });

  it("reset hides the previous demo brand while preserving its append-only chat history", async () => {
    const database = setup();
    const options = { hashPasswordFn: async () => "test-password-hash", sourceDatabase: connection };
    const first = await seedDemoData(database, options);
    const reset = await seedDemoData(database, { ...options, reset: true });
    expect(reset.brandId).not.toBe(first.brandId);
    expect(database.select().from(brands).where(eq(brands.id, first.brandId)).get()?.deletedAt).not.toBeNull();
    expect(database.select().from(chats).where(eq(chats.brandId, first.brandId)).all()).toHaveLength(180);
    expect(database.select().from(chats).where(eq(chats.brandId, reset.brandId)).all()).toHaveLength(180);
  });
});
