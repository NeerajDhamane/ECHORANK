import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import { db, getSqlite } from "@/db";
import { alerts, alertRules, trackingRuns } from "@/db/schema";
import { visibilityByRun, sentimentBreakdown } from "@/lib/analytics";

export const ALERT_TYPES = ["visibility_drop", "competitor_gain", "negative_sentiment", "lost_prompt"] as const;
export type AlertType = typeof ALERT_TYPES[number];
type AppDatabase = typeof db;
const defaults: Array<{ type: AlertType; threshold: number }> = [
  { type: "visibility_drop", threshold: 10 },
  { type: "competitor_gain", threshold: 10 },
  { type: "negative_sentiment", threshold: 25 },
  { type: "lost_prompt", threshold: 0 },
];

export function getAlertSettings(brandId: string, database: AppDatabase = db) {
  for (const rule of defaults) {
    const existing = database.select({ id: alertRules.id }).from(alertRules).where(and(
      eq(alertRules.brandId, brandId), eq(alertRules.type, rule.type),
    )).get();
    if (!existing) database.insert(alertRules).values({ id: randomUUID(), brandId, ...rule, enabled: 1 }).run();
  }
  return database.select().from(alertRules).where(eq(alertRules.brandId, brandId)).all()
    .filter((rule): rule is typeof rule & { type: AlertType } => ALERT_TYPES.includes(rule.type as AlertType))
    .sort((a, b) => ALERT_TYPES.indexOf(a.type) - ALERT_TYPES.indexOf(b.type));
}

export function updateAlertRule(brandId: string, ruleId: string, enabled: boolean, threshold: number, database: AppDatabase = db) {
  const result = database.update(alertRules).set({ enabled: enabled ? 1 : 0, threshold }).where(and(
    eq(alertRules.id, ruleId), eq(alertRules.brandId, brandId),
  )).run();
  return result.changes > 0;
}

export function listAlerts(brandId: string, database: AppDatabase = db) {
  return database.select().from(alerts).where(eq(alerts.brandId, brandId)).orderBy(desc(alerts.createdAt), desc(alerts.id)).limit(100).all();
}

export function unreadAlertCount(brandId: string, database: AppDatabase = db): number {
  return database.select({ id: alerts.id }).from(alerts).where(and(eq(alerts.brandId, brandId), eq(alerts.read, 0))).all().length;
}

export function markAlertRead(brandId: string, alertId: string, read: boolean, database: AppDatabase = db): boolean {
  return database.update(alerts).set({ read: read ? 1 : 0 }).where(and(
    eq(alerts.id, alertId), eq(alerts.brandId, brandId),
  )).run().changes > 0;
}

function writeAlert(brandId: string, ruleId: string, runId: string, message: string, database: AppDatabase): void {
  database.insert(alerts).values({ id: randomUUID(), brandId, ruleId, sourceRunId: runId, message, read: 0 })
    .onConflictDoNothing().run();
}

/** Evaluate real, successful answers only; each rule can fire at most once per completed run. */
export function evaluateAlerts(brandId: string, runId: string, sqlite: Database.Database = getSqlite(), database: AppDatabase = db): number {
  const currentRun = database.select().from(trackingRuns).where(and(eq(trackingRuns.id, runId), eq(trackingRuns.brandId, brandId))).get();
  if (!currentRun || currentRun.status !== "completed") return 0;
  const sample = sqlite.prepare("SELECT COUNT(*) AS n FROM chats WHERE brand_id = @brandId AND run_id = @runId AND error IS NULL AND is_simulated = 0")
    .get({ brandId, runId }) as { n: number };
  if (sample.n < 10) return 0;

  const rules = getAlertSettings(brandId, database).filter((rule) => rule.enabled === 1);
  const trend = visibilityByRun({ brandId }, sqlite);
  const currentIndex = trend.findIndex((run) => run.runId === runId);
  if (currentIndex < 0) return 0;
  const current = trend[currentIndex]!;
  const previous = currentIndex > 0 ? trend[currentIndex - 1]! : null;
  const beforeCount = database.select({ id: alerts.id }).from(alerts).where(eq(alerts.brandId, brandId)).all().length;

  for (const rule of rules) {
    if (rule.type === "visibility_drop" && previous) {
      const oldVisibility = previous.brands.find((brand) => brand.brandId === brandId)?.visibility ?? 0;
      const newVisibility = current.brands.find((brand) => brand.brandId === brandId)?.visibility ?? 0;
      const points = (oldVisibility - newVisibility) * 100;
      if (points >= rule.threshold) writeAlert(brandId, rule.id, runId, `Visibility dropped ${points.toFixed(1)} points to ${(newVisibility * 100).toFixed(1)}% (n=${current.sampleSize}).`, database);
    }
    if (rule.type === "competitor_gain" && previous) {
      const own = current.brands.find((brand) => brand.brandId === brandId)?.visibility ?? 0;
      for (const competitor of current.brands.filter((brand) => brand.brandId !== brandId)) {
        const before = previous.brands.find((brand) => brand.brandId === competitor.brandId)?.visibility ?? 0;
        const points = (competitor.visibility - before) * 100;
        if (points >= rule.threshold && competitor.visibility > own) {
          writeAlert(brandId, rule.id, runId, `${competitor.name} gained ${points.toFixed(1)} visibility points and now exceeds your ${(own * 100).toFixed(1)}% visibility (n=${current.sampleSize}).`, database);
        }
      }
    }
    if (rule.type === "negative_sentiment") {
      const breakdown = sentimentBreakdown({ brandId, runId }, sqlite);
      const share = breakdown.n ? breakdown.negative / breakdown.n * 100 : 0;
      if (breakdown.n >= 10 && share > rule.threshold) writeAlert(brandId, rule.id, runId, `Negative sentiment is ${share.toFixed(1)}% of brand mentions (n=${breakdown.n}).`, database);
    }
    if (rule.type === "lost_prompt" && previous) {
      const previouslyMentioned = sqlite.prepare("SELECT DISTINCT prompt_id AS promptId FROM chats WHERE brand_id = @brandId AND run_id = @runId AND error IS NULL AND is_simulated = 0 AND mentioned = 1")
        .all({ brandId, runId: previous.runId }) as Array<{ promptId: string }>;
      const nowMentioned = new Set((sqlite.prepare("SELECT DISTINCT prompt_id AS promptId FROM chats WHERE brand_id = @brandId AND run_id = @runId AND error IS NULL AND is_simulated = 0 AND mentioned = 1")
        .all({ brandId, runId }) as Array<{ promptId: string }>).map((row) => row.promptId));
      const lost = previouslyMentioned.filter(({ promptId }) => !nowMentioned.has(promptId));
      if (lost.length) writeAlert(brandId, rule.id, runId, `Visibility was lost for ${lost.length} prompt${lost.length === 1 ? "" : "s"} (n=${current.sampleSize}).`, database);
    }
  }
  return database.select({ id: alerts.id }).from(alerts).where(eq(alerts.brandId, brandId)).all().length - beforeCount;
}
