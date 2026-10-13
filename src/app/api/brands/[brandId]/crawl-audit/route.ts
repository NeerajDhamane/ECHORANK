import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { auditAndSave } from "@/lib/crawl-audit";
import { crawlAuditSchema } from "@/lib/crawl-audit-validation";

type Context = { params: Promise<{ brandId: string }> };
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = crawlAuditSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid HTTP or HTTPS URL.", 400);
  try { return json(await auditAndSave(brandId, parsed.data.url)); }
  catch (cause) { return error(cause instanceof Error ? cause.message : "Unable to audit this URL.", 400); }
}
