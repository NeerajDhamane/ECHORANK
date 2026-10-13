import { getCompetitors, getOwnedBrand, softDeleteBrand, updateBrand, BrandConflictError } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { brandPatchSchema } from "@/lib/brand-validation";
import { error, json } from "@/lib/http";

type Context = { params: Promise<{ brandId: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  const brand = getOwnedBrand(brandId, user.id);
  if (!brand) return error("Brand not found.", 404);
  return json({ ...brand, competitors: getCompetitors(brand.id) });
}

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = brandPatchSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide valid brand fields.", 400);
  try {
    const brand = updateBrand(brandId, user.id, parsed.data);
    return brand ? json(brand) : error("Brand not found.", 404);
  } catch (cause) {
    if (cause instanceof BrandConflictError) return error(cause.message, 409);
    return error("Unable to update brand.", 500);
  }
}

export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  return softDeleteBrand(brandId, user.id) ? new Response(null, { status: 204 }) : error("Brand not found.", 404);
}
