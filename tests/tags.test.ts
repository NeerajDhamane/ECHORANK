import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { brands, chats, chatSources, prompts, schema, sources, tags as tagTable, trackingRuns } from "@/db/schema";
import { getOverview } from "@/lib/analytics";
import { getChatPage } from "@/lib/chats";
import { gapOpportunities } from "@/lib/gaps";
import { getSources } from "@/lib/sources";
import { attachPromptTag, createTag, deleteTag, detachPromptTag, listPromptTags, listTags } from "@/lib/tags";

describe("prompt tags", () => {
  let connection: Database.Database | undefined;
  afterEach(() => { connection?.close(); connection = undefined; });

  function setup() {
    connection = new Database(":memory:"); migrateDatabase(connection);
    const db = drizzle(connection, { schema });
    db.insert(brands).values([{ id: "own", userId: "user-a", name: "Own" }, { id: "rival", userId: "user-a", ownerBrandId: "own", name: "Rival" }]).run();
    db.insert(prompts).values([{ id: "tagged", brandId: "own", text: "Rival option", status: "active" }, { id: "untagged", brandId: "own", text: "Own option", status: "active" }]).run();
    db.insert(trackingRuns).values([{ id: "run-a", brandId: "own", startedAt: "2026-10-14 12:00:00", status: "completed" }]).run();
    const rivalHit = JSON.stringify([{ brandId: "rival", name: "Rival", position: 1, sentiment: "positive" }]);
    db.insert(chats).values([
      { id: "chat-a", runId: "run-a", promptId: "tagged", brandId: "own", platform: "A", createdAt: "2026-10-14 12:00:00", mentioned: 0, brandsFound: rivalHit },
      { id: "chat-b", runId: "run-a", promptId: "untagged", brandId: "own", platform: "A", createdAt: "2026-10-14 12:01:00", mentioned: 1, position: 1, sentiment: "positive", brandsFound: JSON.stringify([{ brandId: "own", name: "Own", position: 1, sentiment: "positive" }]) },
    ]).run();
    db.insert(sources).values({ id: "source-a", domain: "rival.example", type: "docs" }).run();
    db.insert(chatSources).values({ chatId: "chat-a", sourceId: "source-a", citationCount: 1 }).run();
    const tag = createTag("user-a", "pricing", db);
    expect(attachPromptTag("own", "user-a", "tagged", tag.id, db)).toBe(true);
    return { db, tag };
  }

  it("enforces case-insensitive per-user uniqueness and attaches only owned tags/prompts", () => {
    const { db, tag } = setup();
    expect(createTag("user-a", "PRICING", db).id).toBe(tag.id);
    expect(createTag("user-b", "PRICING", db).id).not.toBe(tag.id);
    expect(attachPromptTag("own", "user-b", "tagged", tag.id, db)).toBe(false);
    expect(attachPromptTag("own", "user-a", "missing", tag.id, db)).toBe(false);
    expect(listTags("user-a", db)).toHaveLength(1);
    expect(listPromptTags("own", "user-a", db)).toMatchObject({ tagged: [{ id: tag.id, name: "pricing" }] });
  });

  it("applies tag scope to Overview, Chats, Sources, and Gaps", () => {
    const { tag } = setup();
    const scope = { brandId: "own", tagId: tag.id, dateFrom: "2026-10-14", dateTo: "2026-10-14" };
    expect(getOverview(scope, connection!).stats.answers).toBe(1);
    expect(getChatPage(scope, 1, 50, connection!).total).toBe(1);
    expect(getSources(scope, connection!)).toMatchObject({ answers: 1, domains: [{ domain: "rival.example", answers: 1 }] });
    expect(gapOpportunities(scope, connection!).map((item) => item.promptId)).toEqual(["tagged"]);
  });

  it("deletes tag associations without deleting prompts or chat history", () => {
    const { db, tag } = setup();
    expect(detachPromptTag("own", "user-a", "tagged", tag.id, db)).toBe(true);
    expect(listPromptTags("own", "user-a", db)).toEqual({});
    expect(attachPromptTag("own", "user-a", "tagged", tag.id, db)).toBe(true);
    expect(deleteTag("user-a", tag.id, db)).toBe(true);
    expect(deleteTag("user-b", tag.id, db)).toBe(false);
    expect(db.select().from(tagTable).all()).toEqual([]);
    expect(connection!.prepare("SELECT id FROM prompts WHERE id = 'tagged'").get()).toEqual({ id: "tagged" });
    expect(connection!.prepare("SELECT id FROM chats WHERE id = 'chat-a'").get()).toEqual({ id: "chat-a" });
  });
});
