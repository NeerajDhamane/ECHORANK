import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error } from "@/lib/http";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";
import { getRanking } from "@/lib/ranking";
import { toCsv } from "@/lib/csv";

type Context = { params: Promise<{ brandId: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const parsed = overviewQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Invalid ranking filters.", 400);
  const ranking = getRanking(overviewScope(brandId, parsed.data));
  const csv = toCsv([
    ["Brand", "Visibility (%)", "Delta (percentage points)", "Sentiment score (0-100)", "Average rank", "Mentions", "Sample size", "Previous mentions", "Previous sample size"],
    ...ranking.items.map((item) => [item.name, item.visibility.toFixed(1), item.delta === null ? "n/a" : item.delta.toFixed(1), item.sentiment === null ? "n/a" : item.sentiment.toFixed(1), item.averageRank === null ? "n/a" : item.averageRank.toFixed(2), item.mentions, item.sampleSize, item.previousMentions, item.previousSampleSize]),
  ]);
  return new Response(csv, { status: 200, headers: {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": "attachment; filename=echorank-ranking.csv",
    "cache-control": "no-store",
  } });
}
