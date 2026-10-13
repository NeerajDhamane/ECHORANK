import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { schema } from "@/db/schema";
import { createBrand, createCompetitor, getCompetitors, getOwnedBrand, listOwnedBrands, softDeleteBrand, softDeleteCompetitor } from "@/lib/brand-access";

describe("brand access and soft deletion", () => {
  let connection: Database.Database | undefined;

  afterEach(() => { connection?.close(); connection = undefined; });

  it("scopes brands to the owner, stores aliases as JSON, and preserves valid historical references on soft delete", () => {
    connection = new Database(":memory:");
    migrateDatabase(connection);
    const database = drizzle(connection, { schema });
    const brand = createBrand("user-a", { name: "Acme", aliases: ["Acme Co", "AC"], website: "https://acme.example", industry: "Software" }, database);
    const competitor = createCompetitor(brand.id, "user-a", { name: "Rival", aliases: ["Rival Co"], website: null, industry: null }, database);
    const otherBrand = createBrand("user-b", { name: "Other", aliases: [], website: null, industry: null }, database);

    expect(getOwnedBrand(brand.id, "user-b", database)).toBeNull();
    expect(softDeleteBrand(brand.id, "user-b", database)).toBe(false);
    expect(brand.aliases).toEqual(["Acme Co", "AC"]);
    expect(connection.prepare("SELECT aliases FROM brands WHERE id = @id").get({ id: brand.id })).toEqual({ aliases: '["Acme Co","AC"]' });
    expect(getCompetitors(brand.id, database)).toHaveLength(1);
    expect(softDeleteCompetitor(brand.id, "user-b", competitor.id, database)).toBe(false);

    connection.prepare("INSERT INTO topics (id, brand_id, name) VALUES (@id, @brandId, @name)").run({ id: "topic-1", brandId: brand.id, name: "Core" });
    connection.prepare("INSERT INTO prompts (id, brand_id, topic_id, text) VALUES (@id, @brandId, @topicId, @text)").run({ id: "prompt-1", brandId: brand.id, topicId: "topic-1", text: "Which tools?" });
    connection.prepare("INSERT INTO tracking_runs (id, brand_id) VALUES (@id, @brandId)").run({ id: "run-1", brandId: brand.id });
    connection.prepare("INSERT INTO chats (id, run_id, prompt_id, brand_id, platform, raw_response) VALUES (@id, @runId, @promptId, @brandId, @platform, @answer)").run({ id: "chat-1", runId: "run-1", promptId: "prompt-1", brandId: brand.id, platform: "mock", answer: "Acme is one option." });
    connection.prepare("INSERT INTO recommendations (id, brand_id, category, priority, title, detail) VALUES ('rec-1', @brandId, 'content', 'low', 'Title', 'Detail')").run({ brandId: brand.id });
    connection.prepare("INSERT INTO discovery_items (id, brand_id, title, url) VALUES ('discovery-1', @brandId, 'Thread', 'https://example.test/thread')").run({ brandId: brand.id });
    connection.prepare("INSERT INTO crawl_audits (id, brand_id, url, result) VALUES ('crawl-1', @brandId, 'https://acme.example', '{}')").run({ brandId: brand.id });
    connection.prepare("INSERT INTO content_scores (id, brand_id, content, features, score) VALUES ('score-1', @brandId, 'draft', '{}', 50)").run({ brandId: brand.id });
    connection.prepare("INSERT INTO content_briefs (id, brand_id, brief) VALUES ('brief-1', @brandId, 'brief')").run({ brandId: brand.id });
    connection.prepare("INSERT INTO alert_rules (id, brand_id, type, threshold) VALUES ('rule-1', @brandId, 'visibility_drop', 10)").run({ brandId: brand.id });
    connection.prepare("INSERT INTO alerts (id, brand_id, message) VALUES ('alert-1', @brandId, 'Alert')").run({ brandId: brand.id });
    connection.prepare("INSERT INTO reports (id, brand_id, token, snapshot) VALUES ('report-1', @brandId, 'token-1', '{}')").run({ brandId: brand.id });

    expect(softDeleteBrand(brand.id, "user-a", database)).toBe(true);
    expect(getOwnedBrand(brand.id, "user-a", database)).toBeNull();
    expect(listOwnedBrands("user-a", database)).toEqual([]);
    expect(getCompetitors(brand.id, database)).toEqual([]);
    expect(getOwnedBrand(otherBrand.id, "user-b", database)?.id).toBe(otherBrand.id);
    expect(connection.prepare("SELECT raw_response FROM chats WHERE id = @id").get({ id: "chat-1" })).toEqual({ raw_response: "Acme is one option." });
    expect(connection.prepare("SELECT deleted_at FROM brands WHERE id = @id").get({ id: brand.id })).toMatchObject({ deleted_at: expect.any(String) });

    const orphanCheck = connection.prepare(`
      SELECT
        (SELECT COUNT(*) FROM topics t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM prompts t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM tracking_runs t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM chats t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM recommendations t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM discovery_items t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM crawl_audits t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM content_scores t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM content_briefs t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM alert_rules t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM alerts t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) +
        (SELECT COUNT(*) FROM reports t LEFT JOIN brands b ON b.id = t.brand_id WHERE t.brand_id = @brandId AND b.id IS NULL) AS orphans
    `).get({ brandId: brand.id }) as { orphans: number };
    expect(orphanCheck.orphans).toBe(0);
  });

  it("adds the soft-delete column to an existing brands table idempotently", () => {
    connection = new Database(":memory:");
    connection.exec("CREATE TABLE brands (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, owner_brand_id TEXT, name TEXT NOT NULL, aliases TEXT, website TEXT, industry TEXT, auto_track INTEGER NOT NULL DEFAULT 0, track_frequency TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    migrateDatabase(connection);
    migrateDatabase(connection);
    const columns = connection.pragma("table_info(brands)") as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain("deleted_at");
    expect(connection.prepare("SELECT COUNT(*) AS count FROM brands").get()).toEqual({ count: 0 });
  });
});
