import { authenticatedUser } from "@/lib/api-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { error, json } from "@/lib/http";
import { refreshDiscovery } from "@/lib/discovery";

type Context = { params: Promise<{ brandId: string }> };

export async function POST(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  return json(await refreshDiscovery(brandId));
}
