import { getOwnedBrand } from "@/lib/brand-access";
import { getChatPage, parseChatsQuery } from "@/lib/chats";
import { requireApiKeyOrSession } from "@/lib/developer-auth";
import { error, json } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, identity.user.id)) return error("Brand not found.", 404);
  const parsed = parseChatsQuery(new URL(request.url).searchParams, brandId);
  if (!parsed.success) return error("Invalid chat filters.", 400);
  return json(getChatPage(parsed.data.scope, parsed.data.page, parsed.data.limit));
}
