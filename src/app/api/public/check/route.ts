import { isIP } from "node:net";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { PublicCheckError, runPublicCheck } from "@/lib/public-check";

const bodySchema = z.object({
  brand: z.string().trim().min(1).max(60),
  question: z.string().trim().min(1).max(200),
  website: z.string().max(200).optional().default(""),
  startedAt: z.number().int().positive(),
}).strict();
const unsafeText = /<[^>]*>|\bhttps?:\/\/|\bwww\./iu;

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try { raw = await request.json(); } catch { return error("Enter a brand and question to continue."); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return error("Enter a brand (up to 60 characters) and question (up to 200 characters).");
  const { brand, question, website, startedAt } = parsed.data;
  if (website.trim()) return error("Unable to process this request.", 400);
  if (unsafeText.test(brand) || unsafeText.test(question)) return error("Please remove links or HTML from your brand and question.");
  const elapsed = Date.now() - startedAt;
  if (elapsed < 2_000 || elapsed > 60 * 60_000) return error("Please wait a moment, then submit your check.");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded && isIP(forwarded) ? forwarded : realIp && isIP(realIp) ? realIp : "127.0.0.1";
  try {
    return json(await runPublicCheck({ brand, question }, ip));
  } catch (caught) {
    if (caught instanceof PublicCheckError) {
      if (caught.reason === "ip_limit") return error("You’ve reached 5 checks per hour. Please try again later.", 429);
      if (caught.reason === "daily_limit") return error("Today’s public checks are full. Please try tomorrow.", 429);
      return error("The AI provider could not complete this check. Please try again later.", 502);
    }
    return error("The check could not be completed.", 500);
  }
}
