import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, getSqlite } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { toSqlTime } from "@/lib/time";

const DAILY_TRACK_LIMIT = 5;
type AppDatabase = typeof db;

export function createUserApiKey(userId: string, label: string | null, database: AppDatabase = db) {
  const token = `er_${randomBytes(24).toString("base64url")}`;
  const id = randomUUID();
  database.insert(apiKeys).values({ id, userId, keyHash: createHash("sha256").update(token).digest("hex"), label }).run();
  return { id, token, label, createdAt: database.select({ createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.id, id)).get()?.createdAt ?? toSqlTime(new Date()) };
}

export function listUserApiKeys(userId: string, database: AppDatabase = db) {
  return database.select({ id: apiKeys.id, label: apiKeys.label, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt)).all();
}

export function revokeUserApiKey(userId: string, id: string, database: AppDatabase = db): boolean {
  return database.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId))).run().changes > 0;
}

export function authenticateApiKey(token: string, database: AppDatabase = db): { id: string; userId: string } | null {
  if (!/^er_[A-Za-z0-9_-]{32}$/u.test(token)) return null;
  const keyHash = createHash("sha256").update(token).digest("hex");
  const row = database.select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys).innerJoin(users, eq(users.id, apiKeys.userId)).where(eq(apiKeys.keyHash, keyHash)).get();
  if (!row) return null;
  database.update(apiKeys).set({ lastUsedAt: toSqlTime(new Date()) }).where(eq(apiKeys.id, row.id)).run();
  return { id: row.id, userId: row.userId };
}

/** Atomically allow at most five tracking runs per API key and UTC calendar day. */
export function consumeApiKeyTrackingRun(apiKeyId: string, now = new Date(), sqlite = getSqlite()): boolean {
  const usageDate = now.toISOString().slice(0, 10);
  return sqlite.transaction(() => {
    sqlite.prepare("INSERT INTO api_key_usage (api_key_id, usage_date, track_runs) VALUES (@apiKeyId, @usageDate, 0) ON CONFLICT(api_key_id, usage_date) DO NOTHING")
      .run({ apiKeyId, usageDate });
    const result = sqlite.prepare("UPDATE api_key_usage SET track_runs = track_runs + 1 WHERE api_key_id = @apiKeyId AND usage_date = @usageDate AND track_runs < @limit")
      .run({ apiKeyId, usageDate, limit: DAILY_TRACK_LIMIT });
    return result.changes === 1;
  })();
}
