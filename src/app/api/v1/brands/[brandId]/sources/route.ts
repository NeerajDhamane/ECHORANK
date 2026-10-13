import { getOwnedBrand } from "@/lib/brand-access";
import { getSources } from "@/lib/sources";
import { requireApiKeyOrSession } from "@/lib/developer-auth";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";
import { error, json } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, identity.user.id)) return error("Brand not found.", 404);
  const parsed = overviewQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Invalid source filters.", 400);
  return json(getSources(overviewScope(brandId, parsed.data)));
}
