import cron from "node-cron";
import { runScheduledTracking } from "@/lib/scheduled-tracking";

declare global {
  var __echorankCron: boolean | undefined;
}

type Schedule = (expression: string, handler: () => void | Promise<void>) => unknown;

/** Start once per Node process; cron fires daily at 06:00 server-local time. */
export function startScheduler(schedule: Schedule = cron.schedule): boolean {
  if (globalThis.__echorankCron) return false;
  schedule("0 6 * * *", async () => {
    try { await runScheduledTracking(); } catch { /* keep the scheduler alive after a failed day */ }
  });
  globalThis.__echorankCron = true;
  return true;
}
