import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { getOwnedBrand } from "@/lib/brand-access";
import { getProviders } from "@/lib/providers/registry";
import { createTrackingRun, runTracking } from "@/lib/tracking";

/** Track every active owner brand that has daily tracking enabled, one at a time. */
export async function runScheduledTracking(): Promise<{ tracked: number; failed: number }> {
  const dueBrands = db.select({ id: brands.id, userId: brands.userId }).from(brands).where(and(
    isNull(brands.ownerBrandId), isNull(brands.deletedAt), eq(brands.autoTrack, 1),
  )).all();
  let tracked = 0;
  let failed = 0;
  for (const row of dueBrands) {
    const brand = getOwnedBrand(row.id, row.userId);
    if (!brand) continue;
    try {
      const providers = getProviders();
      const run = createTrackingRun(brand.id, providers, db, "scheduled");
      await runTracking(run.runId, brand, providers);
      tracked += 1;
    } catch {
      failed += 1;
    }
  }
  return { tracked, failed };
}
