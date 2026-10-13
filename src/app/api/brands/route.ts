import { BrandConflictError, createBrand, listOwnedBrands } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { brandCreateSchema } from "@/lib/brand-validation";
import { error, json } from "@/lib/http";

export async function GET(): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  return json(listOwnedBrands(user.id));
}

export async function POST(request: Request): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = brandCreateSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid brand name, website, industry, and aliases.", 400);
  try { return json(createBrand(user.id, { ...parsed.data, website: parsed.data.website ?? null, industry: parsed.data.industry ?? null },), 201); }
  catch (cause) {
    if (cause instanceof BrandConflictError) return error(cause.message, 409);
    return error("Unable to create brand.", 500);
  }
}
