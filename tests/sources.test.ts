import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { getSources } from "@/lib/sources";

describe("source summaries", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; });

  function setup() {
    database = new Database(":memory:");
    migrateDatabase(database);
    database.exec(`
      INSERT INTO brands (id,user_id,owner_brand_id,name) VALUES ('own','u',NULL,'Acme'),('rival','u','own','RivalCo');
      INSERT INTO prompts (id,brand_id,text) VALUES ('p','own','Which tools?');
      INSERT INTO tracking_runs (id,brand_id,status) VALUES ('r','own','completed');
      INSERT INTO chats (id,run_id,prompt_id,brand_id,platform,mentioned,brands_found,is_simulated,created_at) VALUES
        ('c1','r','p','own','A',1,'[{"brandId":"own","name":"Acme"},{"brandId":"rival","name":"RivalCo"}]',0,'2026-10-14 10:00:00'),
        ('c2','r','p','own','A',0,'[{"brandId":"rival","name":"RivalCo"}]',0,'2026-10-14 10:01:00'),
        ('c3','r','p','own','A',1,'[{"brandId":"own","name":"Acme"}]',0,'2026-10-14 10:02:00'),
        ('c4','r','p','own','A',0,'[]',0,'2026-10-14 10:03:00'),
        ('c5','r','p','own','A',0,'[{"brandId":"rival","name":"RivalCo"}]',1,'2026-10-14 10:04:00');
      INSERT INTO sources (id,domain,type) VALUES ('s1','docs.example','docs'),('s2','forum.example','forum'),('s3','news.example','news');
      INSERT INTO chat_sources (chat_id,source_id,citation_count) VALUES
        ('c1','s1',2),('c2','s1',1),('c2','s2',1),('c3','s3',1),('c5','s2',1);
    `);
    return database;
  }

  it("computes used percentage, average citations, types, and rival-only gaps against the answer sample", () => {
    const data = getSources({ brandId: "own" }, setup());
    expect(data.answers).toBe(4);
    expect(data.totalCitations).toBe(5);
    expect(data.domains).toEqual([
      { domain: "docs.example", type: "docs", answers: 2, usedPercent: 50, averageCitations: 1.5, citations: 3, citedWith: ["Acme", "RivalCo"] },
      { domain: "forum.example", type: "forum", answers: 1, usedPercent: 25, averageCitations: 1, citations: 1, citedWith: ["RivalCo"] },
      { domain: "news.example", type: "news", answers: 1, usedPercent: 25, averageCitations: 1, citations: 1, citedWith: ["Acme"] },
    ]);
    expect(data.gapDomains.map(({ domain }) => domain)).toEqual(["forum.example"]);
    expect(data.typeBreakdown).toEqual([{ type: "docs", citations: 3 }, { type: "forum", citations: 1 }, { type: "news", citations: 1 }]);
  });

  it("applies analytic scope and excludes simulated rows by default", () => {
    const db = setup();
    const normal = getSources({ brandId: "own", platform: "A" }, db);
    const included = getSources({ brandId: "own", includeSimulated: true }, db);
    expect(normal.totalCitations).toBe(5);
    expect(included.totalCitations).toBe(6);
    expect(included.answers).toBe(5);
    expect(included.domains.find(({ domain }) => domain === "forum.example")?.answers).toBe(2);
  });
});
