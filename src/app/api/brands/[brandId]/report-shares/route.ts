import { z } from "zod";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { error, json } from "@/lib/http";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";
import { createReportData, saveReportSnapshot } from "@/lib/reports";

type Context = { params: Promise<{ brandId: string }> };
const shareRequestSchema = z.object({
  range: z.enum(["7d", "30d", "90d", "custom"]), from: z.string().optional(), to: z.string().optional(), includeSimulated: z.boolean(),
  platform: z.string().optional(), promptId: z.string().optional(), tagId: z.string().optional(), locale: z.string().optional(),
}).strict();

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  const brand = getOwnedBrand(brandId, user.id);
  if (!brand) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const values = shareRequestSchema.safeParse(body.value);
  if (!values.success) return error("Invalid report snapshot request.", 400);
  const parsed = overviewQuerySchema.safeParse({ range: values.data.range, ...(values.data.from ? { from: values.data.from } : {}), ...(values.data.to ? { to: values.data.to } : {}), ...(values.data.platform ? { platform: values.data.platform } : {}), ...(values.data.promptId ? { promptId: values.data.promptId } : {}), ...(values.data.tagId ? { tagId: values.data.tagId } : {}), ...(values.data.locale ? { locale: values.data.locale } : {}), includeSimulated: String(values.data.includeSimulated) });
  if (!parsed.success) return error("Invalid report range.", 400);
  const scope = overviewScope(brandId, parsed.data);
  const snapshot = createReportData(brand, scope);
  return json(saveReportSnapshot(brandId, snapshot));
}
