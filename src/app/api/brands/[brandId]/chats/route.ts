import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { getChatPage, parseChatsQuery } from "@/lib/chats";

type Context = { params: Promise<{ brandId: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const parsed = parseChatsQuery(new URL(request.url).searchParams, brandId);
  if (!parsed.success) return error("Invalid chat filters.", 400);
  const { scope, page, limit } = parsed.data;
  return json(getChatPage(scope, page, limit));
}
