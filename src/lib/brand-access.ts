import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";

type AppDatabase = typeof db;
type BrandRow = typeof brands.$inferSelect;
export type BrandInput = { name: string; aliases: string[]; website: string | null; industry: string | null };
export type BrandPatch = Partial<BrandInput>;
export type BrandRecord = Omit<BrandRow, "aliases"> & { aliases: string[] };

function toBrandRecord(row: BrandRow): BrandRecord {
  let aliases: unknown = [];
  try { aliases = JSON.parse(row.aliases ?? "[]") as unknown; } catch { aliases = []; }
  return { ...row, aliases: Array.isArray(aliases) ? aliases.filter((value): value is string => typeof value === "string") : [] };
}

export class BrandConflictError extends Error {
  constructor() { super("A brand with that name already exists in this workspace."); this.name = "BrandConflictError"; }
}

export function listOwnedBrands(userId: string, database: AppDatabase = db): BrandRecord[] {
  return database.select().from(brands).where(and(
    eq(brands.userId, userId), isNull(brands.ownerBrandId), isNull(brands.deletedAt),
  )).orderBy(brands.name).all().map(toBrandRecord);
}

export function getOwnedBrand(brandId: string, userId: string, database: AppDatabase = db): BrandRecord | null {
  const row = database.select().from(brands).where(and(
    eq(brands.id, brandId), eq(brands.userId, userId), isNull(brands.ownerBrandId), isNull(brands.deletedAt),
  )).get();
  return row ? toBrandRecord(row) : null;
}

export function getCompetitors(brandId: string, database: AppDatabase = db): BrandRecord[] {
  return database.select().from(brands).where(and(
    eq(brands.ownerBrandId, brandId), isNull(brands.deletedAt),
  )).orderBy(brands.name).all().map(toBrandRecord);
}

function ensureUniqueName(name: string, userId: string, ownerBrandId: string | null, database: AppDatabase): void {
  const duplicate = database.select({ id: brands.id }).from(brands).where(and(
    eq(brands.userId, userId), ownerBrandId === null ? isNull(brands.ownerBrandId) : eq(brands.ownerBrandId, ownerBrandId),
    isNull(brands.deletedAt), sql`lower(${brands.name}) = ${name.toLowerCase()}`,
  )).get();
  if (duplicate) throw new BrandConflictError();
}

export function createBrand(userId: string, input: BrandInput, database: AppDatabase = db): BrandRecord {
  ensureUniqueName(input.name, userId, null, database);
  const row = database.insert(brands).values({
    id: randomUUID(), userId, ownerBrandId: null, name: input.name, aliases: JSON.stringify(input.aliases),
    website: input.website, industry: input.industry,
  }).returning().get();
  return toBrandRecord(row);
}

export function updateBrand(brandId: string, userId: string, patch: BrandPatch, database: AppDatabase = db): BrandRecord | null {
  const current = getOwnedBrand(brandId, userId, database);
  if (!current) return null;
  if (patch.name !== undefined && patch.name.toLowerCase() !== current.name.toLowerCase()) ensureUniqueName(patch.name, userId, null, database);
  const values = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.aliases !== undefined ? { aliases: JSON.stringify(patch.aliases) } : {}),
    ...(patch.website !== undefined ? { website: patch.website } : {}),
    ...(patch.industry !== undefined ? { industry: patch.industry } : {}),
  };
  const row = database.update(brands).set(values).where(and(
    eq(brands.id, brandId), eq(brands.userId, userId), isNull(brands.ownerBrandId), isNull(brands.deletedAt),
  )).returning().get();
  return row ? toBrandRecord(row) : null;
}

export function softDeleteBrand(brandId: string, userId: string, database: AppDatabase = db): boolean {
  return database.transaction((transaction) => {
    const changed = transaction.update(brands).set({ deletedAt: sql`CURRENT_TIMESTAMP` }).where(and(
      eq(brands.id, brandId), eq(brands.userId, userId), isNull(brands.ownerBrandId), isNull(brands.deletedAt),
    )).run();
    if (changed.changes === 0) return false;
    transaction.update(brands).set({ deletedAt: sql`CURRENT_TIMESTAMP` }).where(and(
      eq(brands.ownerBrandId, brandId), eq(brands.userId, userId), isNull(brands.deletedAt),
    )).run();
    return true;
  });
}

export function createCompetitor(brandId: string, userId: string, input: BrandInput, database: AppDatabase = db): BrandRecord {
  ensureUniqueName(input.name, userId, brandId, database);
  const row = database.insert(brands).values({
    id: randomUUID(), userId, ownerBrandId: brandId, name: input.name, aliases: JSON.stringify(input.aliases),
    website: input.website, industry: input.industry,
  }).returning().get();
  return toBrandRecord(row);
}

export function softDeleteCompetitor(brandId: string, userId: string, competitorId: string, database: AppDatabase = db): boolean {
  const result = database.update(brands).set({ deletedAt: sql`CURRENT_TIMESTAMP` }).where(and(
    eq(brands.id, competitorId), eq(brands.userId, userId), eq(brands.ownerBrandId, brandId), isNull(brands.deletedAt),
  )).run();
  return result.changes > 0;
}
