import { z } from "zod";
import { getSqlite } from "@/db";
import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error } from "@/lib/http";
import { toCsv } from "@/lib/csv";
import { getRanking } from "@/lib/ranking";
import { getSources } from "@/lib/sources";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";
import { whereClause } from "@/lib/analytics";

type Context = { params: Promise<{ brandId: string }> };
const tableSchema = z.enum(["chats", "ranking", "sources"]);

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const url = new URL(request.url);
  const table = tableSchema.safeParse(url.searchParams.get("table"));
  if (!table.success) return error("Choose chats, ranking, or sources for export.", 400);
  const query = overviewQuerySchema.safeParse(Object.fromEntries([...url.searchParams.entries()].filter(([key]) => key !== "table")));
  if (!query.success) return error("Invalid export filters.", 400);
  const scope = overviewScope(brandId, query.data);
  const db = getSqlite();
  let rows: Array<Array<unknown>>;
  if (table.data === "ranking") {
    const result = getRanking(scope, db);
    rows = [["Brand", "Visibility %", "Delta points", "Average rank", "Sentiment score", "Mentions", "Sample size"], ...result.items.map((item) => [item.name, item.visibility, item.delta, item.averageRank, item.sentiment, item.mentions, item.sampleSize])];
  } else if (table.data === "sources") {
    const result = getSources(scope, db);
    rows = [["Domain", "Type", "Answers citing", "Sample size", "Used %", "Citations", "Average citations"], ...result.domains.map((item) => [item.domain, item.type, item.answers, result.answers, item.usedPercent, item.citations, item.averageCitations])];
  } else {
    const where = whereClause(scope);
    const result = db.prepare(`SELECT c.created_at AS createdAt, p.text AS prompt, c.platform, c.locale, c.mentioned,
      c.position, c.sentiment, c.is_simulated AS simulated, c.raw_response AS answer
      FROM chats c JOIN prompts p ON p.id = c.prompt_id ${where.sql} ORDER BY c.created_at, c.id`).all(where.params) as Array<Record<string, string | number | null>>;
    rows = [["Created at", "Prompt", "Platform", "Locale", "Mentioned", "Position", "Sentiment", "Simulated", "Answer"], ...result.map((item) => [item.createdAt, item.prompt, item.platform, item.locale, item.mentioned, item.position, item.sentiment, item.simulated, item.answer])];
  }
  return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="echorank-${table.data}.csv"`, "cache-control": "no-store" } });
}
