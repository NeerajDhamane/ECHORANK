import { BrandConflictError, createCompetitor, getCompetitors, getOwnedBrand, softDeleteCompetitor } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { brandCreateSchema, competitorDeleteSchema } from "@/lib/brand-validation";
import { error, json } from "@/lib/http";

type Context = { params: Promise<{ brandId: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  return json(getCompetitors(brandId));
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = brandCreateSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid competitor name, website, industry, and aliases.", 400);
  try { return json(createCompetitor(brandId, user.id, { ...parsed.data, website: parsed.data.website ?? null, industry: parsed.data.industry ?? null }), 201); }
  catch (cause) {
    if (cause instanceof BrandConflictError) return error(cause.message, 409);
    return error("Unable to add competitor.", 500);
  }
}

export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = competitorDeleteSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid competitor id.", 400);
  return softDeleteCompetitor(brandId, user.id, parsed.data.competitorId)
    ? new Response(null, { status: 204 })
    : error("Competitor not found.", 404);
}
