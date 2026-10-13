import { afterEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { openDatabase } from "@/db";
import { schema } from "@/db/schema";
import { migrateDatabase } from "@/db/migrate";
import { evaluateAlerts, listAlerts } from "@/lib/alerts";
import { startScheduler } from "@/lib/scheduler";
import { POST as cronPost } from "@/app/api/cron/track/route";

const previousCronSecret = process.env.CRON_SECRET;
afterEach(() => {
  if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousCronSecret;
  delete globalThis.__echorankCron;
});

function makeHistory(currentAnswers: number) {
  const sqlite = openDatabase(":memory:");
  migrateDatabase(sqlite);
  const database = drizzle(sqlite, { schema });
  const brandId = "brand-1";
  const promptId = "prompt-1";
  sqlite.prepare("INSERT INTO brands (id, user_id, name, aliases) VALUES (@id, 'user-1', 'Acme', '[]')").run({ id: brandId });
  sqlite.prepare("INSERT INTO tracking_runs (id, brand_id, started_at, status) VALUES ('previous', @brandId, '2026-01-01 06:00:00', 'completed'), ('current', @brandId, '2026-01-02 06:00:00', 'completed')").run({ brandId });
  const insertChat = sqlite.prepare("INSERT INTO chats (id, run_id, prompt_id, brand_id, platform, is_simulated, mentioned, sentiment, sentiment_score, brands_found) VALUES (@id, @runId, @promptId, @brandId, 'Mock', 0, @mentioned, @sentiment, @sentimentScore, @brandsFound)");
  for (let index = 0; index < 10; index += 1) {
    const previousMention = index < 8;
    insertChat.run({ id: `p-${index}`, runId: "previous", promptId, brandId, mentioned: Number(previousMention), sentiment: previousMention ? "neutral" : null, sentimentScore: previousMention ? 0 : null, brandsFound: previousMention ? JSON.stringify([{ brandId, name: "Acme" }]) : "[]" });
    if (index < currentAnswers) {
      const currentMention = index < 7;
      insertChat.run({ id: `c-${index}`, runId: "current", promptId, brandId, mentioned: Number(currentMention), sentiment: currentMention ? "neutral" : null, sentimentScore: currentMention ? 0 : null, brandsFound: currentMention ? JSON.stringify([{ brandId, name: "Acme" }]) : "[]" });
    }
  }
  return { sqlite, database, brandId };
}

describe("alerts and scheduling", () => {
  it("creates one visibility-drop alert for a 10-point change and dedupes re-evaluation", () => {
    const { sqlite, database, brandId } = makeHistory(10);
    expect(evaluateAlerts(brandId, "current", sqlite, database)).toBe(1);
    expect(evaluateAlerts(brandId, "current", sqlite, database)).toBe(0);
    expect(listAlerts(brandId, database)).toHaveLength(1);
    sqlite.close();
  });

  it("does not evaluate runs below the 10-answer minimum", () => {
    const { sqlite, database, brandId } = makeHistory(9);
    expect(evaluateAlerts(brandId, "current", sqlite, database)).toBe(0);
    expect(listAlerts(brandId, database)).toHaveLength(0);
    sqlite.close();
  });

  it("starts a daily job at most once per process", () => {
    let scheduled = 0;
    const schedule = (expression: string) => { expect(expression).toBe("0 6 * * *"); scheduled += 1; };
    expect(startScheduler(schedule)).toBe(true);
    expect(startScheduler(schedule)).toBe(false);
    expect(scheduled).toBe(1);
  });

  it("rejects cron requests without a configured secret", async () => {
    delete process.env.CRON_SECRET;
    const response = await cronPost(new Request("http://localhost/api/cron/track", { method: "POST" }));
    expect(response.status).toBe(401);
  });
});
