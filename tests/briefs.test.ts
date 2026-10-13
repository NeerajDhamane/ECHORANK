import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { buildBrief, getBriefContext } from "@/lib/briefs";

describe("content briefs", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; });

  it("creates a no-key deterministic brief with actual rival evidence and cited domains", () => {
    const brief = buildBrief({ promptId: "p", prompt: "Which cloud host is reliable?", rivals: ["Nimbus Cloud"], snippets: ["Nimbus Cloud offers managed backups."], domains: ["reviews.example"] }, { name: "Acme", industry: "cloud hosting", website: null });
    expect(brief).toContain("Nimbus Cloud");
    expect(brief).toContain("reviews.example");
    expect(brief).toContain("Nimbus Cloud offers managed backups.");
    expect(brief).toContain("[FILL IN]");
    expect(brief).toContain("Do not make unsupported claims about Acme");
  });

  it("collects rival snippets and domains from the selected prompt only", () => {
    database = new Database(":memory:");
    migrateDatabase(database);
    database.exec(`
      INSERT INTO brands(id,user_id,name) VALUES ('own','u','Acme');
      INSERT INTO brands(id,user_id,owner_brand_id,name) VALUES ('r','u','own','Nimbus Cloud');
      INSERT INTO prompts(id,brand_id,text,status) VALUES ('p','own','Which cloud host is reliable?','active'),('other','own','Other question?','active');
      INSERT INTO tracking_runs(id,brand_id,status) VALUES ('run','own','completed');
      INSERT INTO chats(id,run_id,prompt_id,brand_id,platform,raw_response,brands_found,created_at) VALUES
        ('c','run','p','own','Test','Nimbus Cloud offers managed backups.','[{"brandId":"r","name":"Nimbus Cloud"}]','2026-10-14 10:00:00');
      INSERT INTO sources(id,domain,type) VALUES ('s','reviews.example','review');
      INSERT INTO chat_sources(chat_id,source_id,citation_count) VALUES ('c','s',1);
    `);
    const context = getBriefContext("own", "p", database);
    expect(context).toMatchObject({ prompt: "Which cloud host is reliable?", rivals: ["Nimbus Cloud"], snippets: ["Nimbus Cloud offers managed backups."], domains: ["reviews.example"] });
    expect(getBriefContext("own", "other", database)).toMatchObject({ rivals: [], snippets: [], domains: [] });
    expect(getBriefContext("other-brand", "p", database)).toBeNull();
  });
});
