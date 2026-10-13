import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { promptTags, prompts, tags } from "@/db/schema";

type AppDatabase = typeof db;
export type TagRecord = typeof tags.$inferSelect;

export function listTags(userId: string, database: AppDatabase = db): TagRecord[] {
  return database.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name).all();
}

/** Tag names are compared case-insensitively; a repeated name returns its existing tag. */
export function createTag(userId: string, name: string, database: AppDatabase = db): TagRecord {
  return database.transaction((tx) => {
    const existing = tx.select().from(tags).where(and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${name})`)).get();
    if (existing) return existing;
    return tx.insert(tags).values({ id: randomUUID(), userId, name }).returning().get();
  });
}

export function listPromptTags(brandId: string, userId: string, database: AppDatabase = db): Record<string, TagRecord[]> {
  const rows = database.select({ promptId: promptTags.promptId, tag: tags }).from(promptTags)
    .innerJoin(tags, eq(tags.id, promptTags.tagId)).innerJoin(prompts, eq(prompts.id, promptTags.promptId))
    .where(and(eq(prompts.brandId, brandId), eq(tags.userId, userId))).all();
  const result: Record<string, TagRecord[]> = {};
  for (const row of rows) (result[row.promptId] ??= []).push(row.tag);
  return result;
}

export function attachPromptTag(brandId: string, userId: string, promptId: string, tagId: string, database: AppDatabase = db): boolean {
  const valid = database.select({ id: prompts.id }).from(prompts).innerJoin(tags, eq(tags.id, tagId))
    .where(and(eq(prompts.id, promptId), eq(prompts.brandId, brandId), eq(tags.userId, userId))).get();
  if (!valid) return false;
  database.insert(promptTags).values({ promptId, tagId }).onConflictDoNothing().run();
  return true;
}

export function detachPromptTag(brandId: string, userId: string, promptId: string, tagId: string, database: AppDatabase = db): boolean {
  const valid = database.select({ id: prompts.id }).from(prompts).innerJoin(tags, eq(tags.id, tagId))
    .where(and(eq(prompts.id, promptId), eq(prompts.brandId, brandId), eq(tags.userId, userId))).get();
  if (!valid) return false;
  database.delete(promptTags).where(and(eq(promptTags.promptId, promptId), eq(promptTags.tagId, tagId))).run();
  return true;
}

/** Deleting a user's tag removes its prompt associations but leaves prompt/history rows intact. */
export function deleteTag(userId: string, tagId: string, database: AppDatabase = db): boolean {
  return database.transaction((tx) => {
    const tag = tx.select({ id: tags.id }).from(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId))).get();
    if (!tag) return false;
    tx.delete(promptTags).where(eq(promptTags.tagId, tagId)).run();
    return tx.delete(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId))).run().changes > 0;
  });
}
