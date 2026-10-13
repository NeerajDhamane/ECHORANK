import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { getOverview } from "@/lib/analytics";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";

type Context = { params: Promise<{ brandId: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);

  const url = new URL(request.url);
  const parsed = overviewQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return error("Invalid overview filters.", 400);
  return json(getOverview(overviewScope(brandId, parsed.data)));
}
