import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { prompts, topics } from "@/db/schema";

type AppDatabase = typeof db;
export type PromptStatus = "active" | "suggested" | "inactive";
export type PromptRecord = typeof prompts.$inferSelect;
export type TopicRecord = typeof topics.$inferSelect;
export type PromptInput = { text: string; topicId: string | null; status: PromptStatus; locale: string };
export type PromptPatch = Partial<PromptInput>;

export class TopicConflictError extends Error {
  constructor() { super("A topic with that name already exists."); this.name = "TopicConflictError"; }
}

export function getBrandTopics(brandId: string, database: AppDatabase = db): TopicRecord[] {
  return database.select().from(topics).where(eq(topics.brandId, brandId)).orderBy(topics.name).all();
}

export function listPrompts(brandId: string, status?: PromptStatus, database: AppDatabase = db): PromptRecord[] {
  return database.select().from(prompts).where(and(
    eq(prompts.brandId, brandId), isNull(prompts.deletedAt), status === undefined ? undefined : eq(prompts.status, status),
  )).orderBy(prompts.createdAt, prompts.text).all();
}

export function getOwnedPrompt(brandId: string, promptId: string, database: AppDatabase = db): PromptRecord | null {
  return database.select().from(prompts).where(and(
    eq(prompts.id, promptId), eq(prompts.brandId, brandId), isNull(prompts.deletedAt),
  )).get() ?? null;
}

function validTopic(brandId: string, topicId: string | null, database: AppDatabase): boolean {
  if (topicId === null) return true;
  return Boolean(database.select({ id: topics.id }).from(topics).where(and(eq(topics.id, topicId), eq(topics.brandId, brandId))).get());
}

export function createPrompt(brandId: string, input: PromptInput, database: AppDatabase = db): PromptRecord | null {
  if (!validTopic(brandId, input.topicId, database)) return null;
  return database.insert(prompts).values({ id: randomUUID(), brandId, text: input.text, topicId: input.topicId, status: input.status, locale: input.locale }).returning().get();
}

export function updatePrompt(brandId: string, promptId: string, patch: PromptPatch, database: AppDatabase = db): PromptRecord | null {
  if (!getOwnedPrompt(brandId, promptId, database)) return null;
  if (patch.topicId !== undefined && !validTopic(brandId, patch.topicId, database)) return null;
  const values = {
    ...(patch.text !== undefined ? { text: patch.text } : {}),
    ...(patch.topicId !== undefined ? { topicId: patch.topicId } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
  };
  return database.update(prompts).set(values).where(and(
    eq(prompts.id, promptId), eq(prompts.brandId, brandId), isNull(prompts.deletedAt),
  )).returning().get() ?? null;
}

export function softDeletePrompt(brandId: string, promptId: string, database: AppDatabase = db): boolean {
  return database.update(prompts).set({ deletedAt: sql`CURRENT_TIMESTAMP` }).where(and(
    eq(prompts.id, promptId), eq(prompts.brandId, brandId), isNull(prompts.deletedAt),
  )).run().changes > 0;
}

export function createTopic(brandId: string, name: string, database: AppDatabase = db): TopicRecord {
  const duplicate = database.select({ id: topics.id }).from(topics).where(and(
    eq(topics.brandId, brandId), sql`lower(${topics.name}) = ${name.toLowerCase()}`,
  )).get();
  if (duplicate) throw new TopicConflictError();
  return database.insert(topics).values({ id: randomUUID(), brandId, name }).returning().get();
}
