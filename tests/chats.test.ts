import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { getChatDetail, getChatPage, parseChatsQuery } from "@/lib/chats";

describe("Chats query and data access", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; });

  function setup() {
    database = new Database(":memory:");
    migrateDatabase(database);
    database.exec(`
      INSERT INTO brands (id,user_id,name,aliases) VALUES ('own','u','Acme','["ACME"]'),('rival','u','RivalCo','[]');
      UPDATE brands SET owner_brand_id='own' WHERE id='rival';
      INSERT INTO topics (id,brand_id,name) VALUES ('topic','own','Research');
      INSERT INTO prompts (id,brand_id,topic_id,text) VALUES ('p1','own','topic','Best tools?'),('p2','own','topic','Other tools?');
      INSERT INTO tracking_runs (id,brand_id,started_at,status) VALUES ('r1','own','2026-10-10 08:00:00','completed'),('r2','own','2026-10-11 08:00:00','completed');
      INSERT INTO chats (id,run_id,prompt_id,brand_id,platform,raw_response,mentioned,sentiment,brands_found,cited_sources,created_at)
        VALUES ('c1','r1','p1','own','Alpha','<b>Acme</b> and RivalCo','1','positive','[{"brandId":"own","name":"Acme","position":1}]','["docs.example"]','2026-10-10 08:01:00'),
               ('c2','r2','p1','own','Beta','No mention','0','neutral','[]','[]','2026-10-11 08:01:00'),
               ('c3','r2','p2','own','Alpha','RivalCo','0','negative','[{"brandId":"rival","name":"RivalCo","position":1}]','["docs.example"]','2026-10-11 09:01:00');
      INSERT INTO sources (id,domain,type) VALUES ('s1','docs.example','docs');
      INSERT INTO chat_sources (chat_id,source_id,citation_count) VALUES ('c1','s1',2);
    `);
    return database;
  }

  it("applies filters and 50-row paging to successful brand answers", () => {
    const db = setup();
    const parsed = parseChatsQuery(new URLSearchParams("range=custom&from=2026-10-10&to=2026-10-11&platform=Alpha&mentioned=false&sentiment=negative"), "own");
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(getChatPage(parsed.data.scope, parsed.data.page, parsed.data.limit, db).chats.map((chat) => chat.id)).toEqual(["c3"]);
    expect(getChatPage({ brandId: "own", includeSimulated: true }, 1, 1, db)).toMatchObject({ total: 3, pages: 3, chats: [{ id: "c3" }] });
  });

  it("returns escaped-renderable answer text with citations and found-brand aliases", () => {
    const db = setup();
    const detail = getChatDetail({ brandId: "own", includeSimulated: true }, "c1", db);
    expect(detail).toMatchObject({ rawResponse: "<b>Acme</b> and RivalCo", sources: [{ domain: "docs.example", citationCount: 2 }], highlightBrands: [{ id: "own", name: "Acme", aliases: ["ACME"] }] });
    expect(getChatDetail({ brandId: "own" }, "missing", db)).toBeNull();
  });

  it("rejects incomplete custom date ranges", () => {
    expect(parseChatsQuery(new URLSearchParams("range=custom&from=2026-10-10"), "own").success).toBe(false);
  });
});
