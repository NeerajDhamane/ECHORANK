import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { getOverview } from "@/lib/analytics";
import { createReportData, getSharedReport, revokeReportShare, saveReportSnapshot } from "@/lib/reports";

describe("report data and immutable share snapshots", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; });

  function setup() {
    database = new Database(":memory:"); migrateDatabase(database);
    database.exec(`INSERT INTO brands(id,user_id,name,industry) VALUES ('own','u','Acme Cloud','cloud hosting');
      INSERT INTO brands(id,user_id,owner_brand_id,name) VALUES ('rival','u','own','Nimbus Cloud');
      INSERT INTO prompts(id,brand_id,text,status) VALUES ('p1','own','Best cloud hosting?', 'active'),('p2','own','Cloud storage choices?', 'active');
      INSERT INTO tracking_runs(id,brand_id,status,started_at) VALUES ('old-run','own','completed','2026-09-15 12:00:00'),('new-run','own','completed','2026-10-10 12:00:00');`);
    const insert = database.prepare(`INSERT INTO chats(id,run_id,prompt_id,brand_id,platform,mentioned,position,sentiment,sentiment_score,brands_found,is_simulated,created_at)
      VALUES (@id,@runId,@promptId,'own','Groq',@mentioned,@position,@sentiment,@score,@found,@simulated,@createdAt)`);
    insert.run({ id: "prior", runId: "old-run", promptId: "p1", mentioned: 0, position: null, sentiment: null, score: null, found: "[]", simulated: 0, createdAt: "2026-09-15 12:00:00" });
    insert.run({ id: "current-1", runId: "new-run", promptId: "p1", mentioned: 1, position: 1, sentiment: "positive", score: 0.8, found: JSON.stringify([{ brandId: "own", name: "Acme Cloud", position: 1 }, { brandId: "rival", name: "Nimbus Cloud", position: 2 }]), simulated: 0, createdAt: "2026-10-10 12:00:00" });
    insert.run({ id: "current-2", runId: "new-run", promptId: "p2", mentioned: 0, position: null, sentiment: null, score: null, found: "[]", simulated: 0, createdAt: "2026-10-11 12:00:00" });
    insert.run({ id: "current-sim", runId: "new-run", promptId: "p2", mentioned: 0, position: null, sentiment: null, score: null, found: "[]", simulated: 1, createdAt: "2026-10-12 12:00:00" });
    return database;
  }

  const scope = { brandId: "own", dateFrom: "2026-10-01", dateTo: "2026-10-31" };
  const brand = { id: "own", name: "Acme Cloud", website: null, industry: "cloud hosting" };

  it("uses the same KPI values as Overview and reports per-month/per-prompt sample counts", () => {
    const db = setup();
    const overview = getOverview(scope, db);
    const report = createReportData(brand, scope, "2026-11-01T00:00:00.000Z", db);
    expect(report.overview.stats).toEqual(overview.stats);
    expect(report).toMatchObject({ promptCount: 2, simulation: { real: 2, simulated: 1 } });
    expect(report.monthly.at(-1)).toMatchObject({ month: "2026-10", answers: 2, visibility: 50, positiveSentiment: 100, sentimentN: 1 });
    expect(report.prompts.find((item) => item.promptId === "p1")).toMatchObject({ answers: 1, mentions: 1, visibility: 100, previousVisibility: 0, delta: 100 });
    expect(report.overview.stats.answers).toBe(2);
  });

  it("stores a frozen public snapshot and revocation makes it unavailable", () => {
    const db = setup();
    const first = createReportData(brand, scope, "2026-11-01T00:00:00.000Z", db);
    const share = saveReportSnapshot("own", first, db);
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{32}$/u);
    expect(getSharedReport(share.token, db)).toEqual(first);
    db.prepare(`INSERT INTO chats(id,run_id,prompt_id,brand_id,platform,mentioned,position,sentiment,sentiment_score,brands_found,is_simulated,created_at)
      VALUES ('later','new-run','p1','own','Groq',1,1,'positive',1,'[{"brandId":"own","name":"Acme Cloud","position":1}]',0,'2026-10-20 12:00:00')`).run();
    expect(createReportData(brand, scope, "2026-11-02T00:00:00.000Z", db).overview.stats).not.toEqual(first.overview.stats);
    expect(getSharedReport(share.token, db)).toEqual(first);
    expect(revokeReportShare("other-brand", share.id, db)).toBe(false);
    expect(revokeReportShare("own", share.id, db)).toBe(true);
    expect(getSharedReport(share.token, db)).toBeNull();
  });

  it("fills empty months with null metrics so the report can render them as dashes", () => {
    const db = setup();
    const report = createReportData(brand, { ...scope, dateFrom: "2026-08-01" }, "2026-11-01T00:00:00.000Z", db);
    expect(report.monthly.map((item) => item.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(report.monthly[0]).toMatchObject({ answers: 0, visibility: null, positiveSentiment: null, averageRank: null });
  });
});
