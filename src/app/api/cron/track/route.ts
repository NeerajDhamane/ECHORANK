import { timingSafeEqual } from "node:crypto";
import { error, json } from "@/lib/http";
import { runScheduledTracking } from "@/lib/scheduled-tracking";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const supplied = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return error("Unauthorized.", 401);
  const result = await runScheduledTracking();
  return json(result);
}
