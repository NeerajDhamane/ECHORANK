import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { gapOpportunities } from "@/lib/gaps";

describe("gap opportunity ranking", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; });

  function setup() {
    database = new Database(":memory:");
    migrateDatabase(database);
    database.exec(`
      INSERT INTO brands (id,user_id,owner_brand_id,name) VALUES ('own','u',NULL,'Acme'),('r1','u','own','Rival One'),('r2','u','own','Rival Two');
      INSERT INTO prompts (id,brand_id,text,status) VALUES
        ('p-low','own','Small sample?','active'),('p-more','own','More answers?','active'),('p-less','own','Fewer answers?','active'),
        ('p-dom','own','Dominant rival?','active'),('p-own','own','Always us?','active'),('p-inactive','own','Disabled prompt?','inactive');
      INSERT INTO tracking_runs (id,brand_id,status) VALUES ('run','own','completed');
    `);
    const add = database.prepare(`INSERT INTO chats (id,run_id,prompt_id,brand_id,platform,mentioned,is_simulated,brands_found,created_at)
      VALUES (@id,'run',@promptId,'own',@platform,@mentioned,@simulated,@found,@createdAt)`);
    let sequence = 0;
    function row(promptId: string, { own = false, rivals = [], platform = "A", simulated = false }: { own?: boolean; rivals?: string[]; platform?: string; simulated?: boolean } = {}) {
      sequence += 1;
      add.run({ id: `c${sequence}`, promptId, platform, mentioned: own ? 1 : 0, simulated: simulated ? 1 : 0,
        found: JSON.stringify([...(own ? [{ brandId: "own", name: "Acme" }] : []), ...rivals.map((id) => ({ brandId: id, name: id === "r1" ? "Rival One" : "Rival Two" }))]),
        createdAt: `2026-10-14 10:${String(sequence).padStart(2, "0")}:00` });
    }
    row("p-low", { rivals: ["r1"] }); row("p-low", { rivals: ["r1"] });
    for (let index = 0; index < 6; index++) row("p-more", { rivals: index < 4 ? ["r1"] : [] });
    for (let index = 0; index < 3; index++) row("p-less", { rivals: index < 2 ? ["r1"] : [] });
    row("p-dom", { rivals: ["r1", "r2"] }); row("p-dom", { rivals: ["r2"] }); row("p-dom");
    for (let index = 0; index < 4; index++) row("p-own", { own: true, rivals: index === 0 ? ["r1"] : [] });
    row("p-inactive", { rivals: ["r1"] });
    row("p-more", { simulated: true, rivals: ["r2"] });
    return database;
  }

  it("scores and sorts only positive gaps, selects the dominant rival, and flags n below 3", () => {
    const rows = gapOpportunities({ brandId: "own" }, setup());
    expect(rows.map(({ promptId }) => promptId)).toEqual(["p-low", "p-more", "p-dom", "p-less"]);
    expect(rows[0]).toMatchObject({ answers: 2, yourRate: 0, rivalRate: 100, opportunity: 1, lowData: true });
    expect(rows[1]).toMatchObject({ answers: 6, rivalMentions: 4, topRival: "Rival One", opportunity: 0.667, lowData: false });
    expect(rows[2]).toMatchObject({ answers: 3, rivalMentions: 2, topRival: "Rival Two", opportunity: 0.667 });
    expect(rows.some(({ promptId }) => promptId === "p-own" || promptId === "p-inactive")).toBe(false);
  });

  it("respects shared date/platform/simulated scope and excludes zero-opportunity prompts", () => {
    const db = setup();
    expect(gapOpportunities({ brandId: "own", platform: "A", dateFrom: "2026-10-14", dateTo: "2026-10-14" }, db).every((item) => item.answers >= 2)).toBe(true);
    const withSimulated = gapOpportunities({ brandId: "own", includeSimulated: true }, db);
    expect(withSimulated.find(({ promptId }) => promptId === "p-more")?.answers).toBe(7);
    expect(withSimulated.some(({ promptId }) => promptId === "p-own")).toBe(false);
  });
});
