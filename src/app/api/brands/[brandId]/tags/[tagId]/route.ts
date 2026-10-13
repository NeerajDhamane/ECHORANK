import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error } from "@/lib/http";
import { deleteTag } from "@/lib/tags";

type Context = { params: Promise<{ brandId: string; tagId: string }> };
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId, tagId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  return deleteTag(user.id, tagId) ? new Response(null, { status: 204 }) : error("Tag not found.", 404);
}
