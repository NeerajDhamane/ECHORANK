import { randomBytes, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import type { BrandRecord } from "@/lib/brand-access";
import { getOverview, monthlySummary, promptPerformance, simulationCounts, whereClause, type Scope } from "@/lib/analytics";
import { getRanking } from "@/lib/ranking";
import { getSources } from "@/lib/sources";
import { gapOpportunities } from "@/lib/gaps";
import { listRecommendations } from "@/lib/recommendations";

export function createReportData(brand: Pick<BrandRecord, "id" | "name" | "website" | "industry">, scope: Scope, generatedAt = new Date().toISOString(), database: Database.Database = getSqlite()) {
  const where = whereClause(scope);
  const promptCount = (database.prepare(`SELECT COUNT(DISTINCT c.prompt_id) AS count FROM chats c ${where.sql}`).get(where.params) as { count: number }).count;
  const overview = getOverview(scope, database);
  return {
    brand: { id: brand.id, name: brand.name, website: brand.website, industry: brand.industry },
    range: { from: scope.dateFrom ? new Date(scope.dateFrom).toISOString().slice(0, 10) : "—", to: scope.dateTo ? new Date(scope.dateTo).toISOString().slice(0, 10) : "—" },
    generatedAt,
    overview,
    ranking: getRanking(scope, database),
    monthly: monthlySummary(scope, database),
    prompts: promptPerformance(scope, database),
    promptCount,
    sources: getSources(scope, database),
    gaps: gapOpportunities(scope, database).slice(0, 5),
    recommendations: listRecommendations(brand.id, false, database),
    simulation: simulationCounts(scope, database),
  };
}

export type ReportData = ReturnType<typeof createReportData>;
export type ReportShare = { id: string; token: string; createdAt: string };

export function listReportShares(brandId: string, database: Database.Database = getSqlite()): ReportShare[] {
  return database.prepare("SELECT id, token, created_at AS createdAt FROM reports WHERE brand_id = @brandId ORDER BY created_at DESC").all({ brandId }) as ReportShare[];
}

export function saveReportSnapshot(brandId: string, data: ReportData, database: Database.Database = getSqlite()): ReportShare {
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  database.prepare("INSERT INTO reports (id, brand_id, token, snapshot, date_from, date_to) VALUES (@id, @brandId, @token, @snapshot, @dateFrom, @dateTo)").run({
    id, brandId, token, snapshot: JSON.stringify(data), dateFrom: data.range.from === "—" ? null : data.range.from, dateTo: data.range.to === "—" ? null : data.range.to,
  });
  const createdAt = (database.prepare("SELECT created_at AS createdAt FROM reports WHERE id = @id").get({ id }) as { createdAt: string }).createdAt;
  return { id, token, createdAt };
}

export function revokeReportShare(brandId: string, reportId: string, database: Database.Database = getSqlite()): boolean {
  return database.prepare("DELETE FROM reports WHERE id = @reportId AND brand_id = @brandId").run({ reportId, brandId }).changes > 0;
}

export function getSharedReport(token: string, database: Database.Database = getSqlite()): ReportData | null {
  const row = database.prepare("SELECT snapshot FROM reports WHERE token = @token").get({ token }) as { snapshot: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.snapshot) as ReportData; } catch { return null; }
}
