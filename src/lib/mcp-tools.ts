import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getOwnedBrand, listOwnedBrands } from "@/lib/brand-access";
import { getOverview } from "@/lib/analytics";
import { createPrompt } from "@/lib/prompt-access";
import { promptCreateSchema } from "@/lib/prompt-validation";
import { consumeApiKeyTrackingRun } from "@/lib/api-keys";
import { createTrackingRun, runTracking } from "@/lib/tracking";
import { getProviders } from "@/lib/providers/registry";
import { gapOpportunities } from "@/lib/gaps";
import { listRecommendations } from "@/lib/recommendations";

const errorResult = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });
const jsonResult = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function createEchoRankMcpServer(userId: string, apiKeyId: string): McpServer {
  const server = new McpServer({ name: "echorank", version: "1.0.0" });

  server.registerTool("list_brands", { description: "List active brands owned by the authenticated EchoRank user.", inputSchema: z.object({}) }, async () =>
    jsonResult(listOwnedBrands(userId).map(({ id, name, website, industry }) => ({ id, name, website, industry }))));

  server.registerTool("get_overview", { description: "Read visibility and evidence analytics for an owned brand.", inputSchema: z.object({ brandId: z.string().uuid(), range: z.enum(["7d", "30d", "90d"]).optional() }) }, async ({ brandId, range }) => {
    if (!getOwnedBrand(brandId, userId)) return errorResult("Brand not found.");
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(`${to}T00:00:00.000Z`); fromDate.setUTCDate(fromDate.getUTCDate() - days + 1);
    return jsonResult(getOverview({ brandId, dateFrom: fromDate.toISOString().slice(0, 10), dateTo: to }));
  });

  server.registerTool("add_prompt", { description: "Add a tracked buyer-intent prompt to an owned brand.", inputSchema: z.object({ brandId: z.string().uuid(), text: z.string().trim().min(3).max(500), topicId: z.string().uuid().nullable().optional(), locale: z.string().trim().min(2).max(35).optional() }) }, async ({ brandId, text, topicId, locale }) => {
    if (!getOwnedBrand(brandId, userId)) return errorResult("Brand not found.");
    const parsed = promptCreateSchema.safeParse({ text, topicId: topicId ?? null, locale: locale ?? "global", status: "active" });
    if (!parsed.success) return errorResult("Please provide valid prompt details.");
    const prompt = createPrompt(brandId, parsed.data);
    return prompt ? jsonResult(prompt) : errorResult("Topic not found.");
  });

  server.registerTool("run_tracking", { description: "Start an asynchronous tracking run for an owned brand. Limited to five runs per API key each UTC day.", inputSchema: z.object({ brandId: z.string().uuid() }) }, async ({ brandId }) => {
    const brand = getOwnedBrand(brandId, userId);
    if (!brand) return errorResult("Brand not found.");
    if (!consumeApiKeyTrackingRun(apiKeyId)) return errorResult("This API key reached its daily tracking-run limit (5). Try again tomorrow.");
    const providers = getProviders();
    const run = createTrackingRun(brandId, providers);
    void runTracking(run.runId, brand, providers);
    return jsonResult(run);
  });

  server.registerTool("get_gap_opportunities", { description: "Read prompt-level competitor gaps for an owned brand.", inputSchema: z.object({ brandId: z.string().uuid() }) }, async ({ brandId }) => {
    if (!getOwnedBrand(brandId, userId)) return errorResult("Brand not found.");
    return jsonResult(gapOpportunities({ brandId }));
  });

  server.registerTool("get_recommendations", { description: "Read prioritized evidence-backed recommendations for an owned brand.", inputSchema: z.object({ brandId: z.string().uuid() }) }, async ({ brandId }) => {
    if (!getOwnedBrand(brandId, userId)) return errorResult("Brand not found.");
    return jsonResult(listRecommendations(brandId));
  });
  return server;
}
