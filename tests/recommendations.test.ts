import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { evaluateRecommendationRules, generateRecommendations, listRecommendations, updateRecommendationStatus } from "@/lib/recommendations";

describe("evidence-based recommendation rules", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; });

  function setup() {
    database = new Database(":memory:");
    migrateDatabase(database);
    database.exec(`
      INSERT INTO brands (id,user_id,owner_brand_id,name) VALUES ('own','u',NULL,'Acme'),('r1','u','own','Rival One'),('r2','u','own','Rival Two');
      INSERT INTO prompts (id,brand_id,text) VALUES ('p1','own','Best service?'),('p2','own','Alternatives?');
      INSERT INTO tracking_runs (id,brand_id,started_at,status) VALUES ('old','own','2026-10-01 00:00:00','completed'),('previous','own','2026-10-02 00:00:00','completed'),('latest','own','2026-10-03 00:00:00','completed');
      INSERT INTO chats (id,run_id,prompt_id,brand_id,platform,mentioned,position,sentiment,sentiment_score,cited_sources,brands_found,created_at) VALUES
        ('old-1','old','p1','own','A',1,2,'positive',0.5,'[]','[{"brandId":"own","name":"Acme"}]','2026-10-01 01:00:00'),
        ('old-2','old','p1','own','A',0,NULL,NULL,NULL,'[]','[]','2026-10-01 02:00:00'),
        ('prev-1','previous','p1','own','A',1,2,'positive',0.5,'[]','[{"brandId":"own","name":"Acme"}]','2026-10-02 01:00:00'),
        ('prev-2','previous','p1','own','A',0,NULL,NULL,NULL,'[]','[]','2026-10-02 02:00:00'),
        ('latest-1','latest','p1','own','A',1,5,'negative',-0.5,'[]','[{"brandId":"own","name":"Acme"}]','2026-10-03 01:00:00'),
        ('latest-2','latest','p2','own','A',0,NULL,NULL,NULL,'[]','[{"brandId":"r1","name":"Rival One"},{"brandId":"r2","name":"Rival Two"}]','2026-10-03 02:00:00'),
        ('latest-3','latest','p2','own','B',0,NULL,NULL,NULL,'[]','[{"brandId":"r1","name":"Rival One"}]','2026-10-03 03:00:00'),
        ('latest-4','latest','p2','own','A',0,NULL,NULL,NULL,'[]','[]','2026-10-03 04:00:00'),
        ('latest-5','latest','p1','own','A',0,NULL,NULL,NULL,'[]','[]','2026-10-03 05:00:00');
      INSERT INTO sources (id,domain,type) VALUES ('forum','community.example','forum');
      INSERT INTO chat_sources (chat_id,source_id,citation_count) VALUES ('latest-2','forum',2),('latest-3','forum',1);
    `);
    return database;
  }

  it("evaluates every data-backed threshold and keeps crawl rules dormant until T023", () => {
    const db = setup();
    db.prepare("INSERT INTO crawl_audits (id,brand_id,url,result,score) VALUES ('crawl','own','https://acme.example','{}',10)").run();
    const rules = evaluateRecommendationRules("own", "latest", db).map(({ rule }) => rule).sort();
    expect(rules).toEqual(["R1", "R10", "R2", "R3", "R4", "R5", "R6", "R7"]);
    expect(rules).not.toContain("R8");
    expect(rules).not.toContain("R9");
  });

  it("emits R11 only when thresholds are clear, deduplicates open recs, and persists done status", () => {
    const db = setup();
    db.exec(`
      DELETE FROM chat_sources;
      DELETE FROM chats;
      DELETE FROM tracking_runs WHERE id <> 'latest';
      INSERT INTO chats (id,run_id,prompt_id,brand_id,platform,mentioned,position,sentiment,cited_sources,brands_found)
      VALUES ('healthy','latest','p1','own','A',1,1,'positive','["docs.example"]','[{"brandId":"own","name":"Acme"}]');
      INSERT INTO sources (id,domain,type) VALUES ('docs','docs.example','docs');
      INSERT INTO chat_sources (chat_id,source_id,citation_count) VALUES ('healthy','docs',1);
    `);
    const first = generateRecommendations("own", "latest", db);
    const second = generateRecommendations("own", "latest", db);
    expect(first.map(({ rule }) => rule)).toEqual(["R11"]);
    expect(second).toEqual([]);
    expect(listRecommendations("own", false, db)).toHaveLength(1);
    expect(updateRecommendationStatus("other", first[0]!.id, "done", db)).toBe(false);
    expect(updateRecommendationStatus("own", first[0]!.id, "done", db)).toBe(true);
    expect(listRecommendations("own", false, db)).toHaveLength(0);
    expect(listRecommendations("own", true, db)[0]?.status).toBe("done");
  });
});
