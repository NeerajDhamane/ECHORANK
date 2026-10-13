import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";
import { getRanking } from "@/lib/ranking";

type Context = { params: Promise<{ brandId: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const parsed = overviewQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Invalid ranking filters.", 400);
  return json(getRanking(overviewScope(brandId, parsed.data)));
}
