import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { createTag, listTags } from "@/lib/tags";
import { tagCreateSchema } from "@/lib/tag-validation";

type Context = { params: Promise<{ brandId: string }> };
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  return json(listTags(user.id));
}
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = tagCreateSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid tag name.", 400);
  return json(createTag(user.id, parsed.data.name), 201);
}
