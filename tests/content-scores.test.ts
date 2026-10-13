import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { brands, contentScores, schema } from "@/db/schema";
import { getContentScoreHistory, scoreAndSaveContent } from "@/lib/content-scores";

describe("saved content scores", () => {
  let connection: Database.Database | undefined;
  afterEach(() => { connection?.close(); connection = undefined; });
  it("saves rescoring history and reports the previous-score delta", () => {
    connection = new Database(":memory:"); migrateDatabase(connection);
    const db = drizzle(connection, { schema });
    db.insert(brands).values({ id: "own", userId: "user-a", name: "Own" }).run();
    const first = scoreAndSaveContent("own", "Short draft.", "Before", db);
    const second = scoreAndSaveContent("own", "<h1>Better draft</h1><h2>Useful details</h2><h2>Answers</h2>", "After", db);
    expect(first.previousScore).toBeNull();
    expect(first.delta).toBeNull();
    expect(second.previousScore).toBe(first.score);
    expect(second.delta).toBe(second.score - first.score);
    expect(getContentScoreHistory("own", db)).toHaveLength(2);
    expect(db.select().from(contentScores).all()).toHaveLength(2);
  });
});
