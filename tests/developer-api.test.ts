import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { apiKeys, schema, users } from "@/db/schema";
import { authenticateApiKey, consumeApiKeyTrackingRun, createUserApiKey, listUserApiKeys, revokeUserApiKey } from "@/lib/api-keys";
import { requireApiKeyOrSession } from "@/lib/developer-auth";

describe("developer API credentials", () => {
  let sqlite: Database.Database | undefined;
  afterEach(() => { sqlite?.close(); sqlite = undefined; });
  function setup() {
    sqlite = new Database(":memory:"); sqlite.pragma("foreign_keys = ON"); migrateDatabase(sqlite);
    const database = drizzle(sqlite, { schema });
    database.insert(users).values({ id: "user-a", name: "A", email: "a@developer.test", passwordHash: "test" }).run();
    return database;
  }

  it("stores only a SHA-256 hash and never returns the key after its one-time creation", () => {
    const database = setup();
    const created = createUserApiKey("user-a", "test client", database);
    expect(created.token).toMatch(/^er_[A-Za-z0-9_-]{32}$/u);
    expect(database.select().from(apiKeys).get()?.keyHash).not.toBe(created.token);
    expect(authenticateApiKey(created.token, database)).toMatchObject({ id: created.id, userId: "user-a" });
    expect(listUserApiKeys("user-a", database)).toEqual([{ id: created.id, label: "test client", createdAt: expect.any(String), lastUsedAt: expect.any(String) }]);
    expect(JSON.stringify(listUserApiKeys("user-a", database))).not.toContain(created.token);
    expect(revokeUserApiKey("user-a", created.id, database)).toBe(true);
    expect(authenticateApiKey(created.token, database)).toBeNull();
  });

  it("rejects a revoked bearer credential with 401 and limits each key to five runs per UTC day", async () => {
    const request = new Request("https://echorank.test/api/v1/brands", { headers: { authorization: `Bearer er_${"a".repeat(32)}` } });
    const auth = await requireApiKeyOrSession(request, () => null);
    expect(auth.response?.status).toBe(401);
    const connection = setup();
    const key = createUserApiKey("user-a", "limit test", connection);
    for (let count = 0; count < 5; count += 1) expect(consumeApiKeyTrackingRun(key.id, new Date("2026-10-14T10:00:00.000Z"), sqlite!)).toBe(true);
    expect(consumeApiKeyTrackingRun(key.id, new Date("2026-10-14T20:00:00.000Z"), sqlite!)).toBe(false);
    expect(consumeApiKeyTrackingRun(key.id, new Date("2026-10-15T00:00:00.000Z"), sqlite!)).toBe(true);
  });
});
