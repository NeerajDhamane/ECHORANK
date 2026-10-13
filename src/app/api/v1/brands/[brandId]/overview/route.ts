import { getOwnedBrand } from "@/lib/brand-access";
import { getOverview } from "@/lib/analytics";
import { error, json } from "@/lib/http";
import { requireApiKeyOrSession } from "@/lib/developer-auth";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";

export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, identity.user.id)) return error("Brand not found.", 404);
  const parsed = overviewQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Invalid overview filters.", 400);
  return json(getOverview(overviewScope(brandId, parsed.data)));
}
