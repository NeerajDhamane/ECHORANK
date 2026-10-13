import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { schema } from "@/db/schema";
import { createBrand } from "@/lib/brand-access";
import { createPrompt, createTopic, getOwnedPrompt, listPrompts, softDeletePrompt, TopicConflictError, updatePrompt } from "@/lib/prompt-access";

describe("prompt access", () => {
  let connection: Database.Database | undefined;
  afterEach(() => { connection?.close(); connection = undefined; });

  it("groups prompts by workspace topics, validates topic ownership, updates status, and preserves chat references on removal", () => {
    connection = new Database(":memory:"); migrateDatabase(connection);
    const database = drizzle(connection, { schema });
    const brand = createBrand("user-a", { name: "Acme", aliases: [], website: null, industry: null }, database);
    const other = createBrand("user-b", { name: "Other", aliases: [], website: null, industry: null }, database);
    const topic = createTopic(brand.id, "Buying questions", database);
    expect(() => createTopic(brand.id, "buying QUESTIONS", database)).toThrow(TopicConflictError);
    const prompt = createPrompt(brand.id, { text: "What tools should a growing team consider?", topicId: topic.id, status: "active", locale: "en-US" }, database);
    expect(prompt?.topicId).toBe(topic.id);
    expect(createPrompt(brand.id, { text: "Invalid topic link", topicId: "00000000-0000-4000-8000-000000000000", status: "active", locale: "global" }, database)).toBeNull();
    expect(createPrompt(other.id, { text: "Other workspace question", topicId: topic.id, status: "active", locale: "global" }, database)).toBeNull();
    expect(updatePrompt(brand.id, prompt!.id, { status: "inactive" }, database)?.status).toBe("inactive");
    expect(listPrompts(brand.id, "active", database)).toEqual([]);
    expect(listPrompts(brand.id, "inactive", database)).toHaveLength(1);

    connection.prepare("INSERT INTO tracking_runs (id, brand_id) VALUES ('run-1', @brandId)").run({ brandId: brand.id });
    connection.prepare("INSERT INTO chats (id, run_id, prompt_id, brand_id, platform, raw_response) VALUES ('chat-1', 'run-1', @promptId, @brandId, 'mock', 'Answer')").run({ promptId: prompt!.id, brandId: brand.id });
    expect(softDeletePrompt(other.id, prompt!.id, database)).toBe(false);
    expect(softDeletePrompt(brand.id, prompt!.id, database)).toBe(true);
    expect(getOwnedPrompt(brand.id, prompt!.id, database)).toBeNull();
    expect(listPrompts(brand.id, undefined, database)).toEqual([]);
    expect(connection.prepare("SELECT prompt_id FROM chats WHERE id = 'chat-1'").get()).toEqual({ prompt_id: prompt!.id });
    expect(connection.prepare("SELECT deleted_at FROM prompts WHERE id = @id").get({ id: prompt!.id })).toMatchObject({ deleted_at: expect.any(String) });
  });

  it("changes a prompt locale without rewriting the locale saved on historical chats", () => {
    connection = new Database(":memory:"); migrateDatabase(connection);
    const database = drizzle(connection, { schema });
    const brand = createBrand("user-locale", { name: "Locale Brand", aliases: [], website: null, industry: null }, database);
    const prompt = createPrompt(brand.id, { text: "Which options are available?", topicId: null, status: "active", locale: "global" }, database)!;
    connection.prepare("INSERT INTO tracking_runs (id, brand_id) VALUES ('locale-run', @brandId)").run({ brandId: brand.id });
    connection.prepare("INSERT INTO chats (id, run_id, prompt_id, brand_id, platform, locale) VALUES ('locale-chat', 'locale-run', @promptId, @brandId, 'Test', 'global')").run({ brandId: brand.id, promptId: prompt.id });

    expect(updatePrompt(brand.id, prompt.id, { locale: "IN" }, database)?.locale).toBe("IN");
    expect(connection.prepare("SELECT locale FROM chats WHERE id = 'locale-chat'").get()).toEqual({ locale: "global" });
  });
});
