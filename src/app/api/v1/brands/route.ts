import { error, json } from "@/lib/http";
import { listOwnedBrands } from "@/lib/brand-access";
import { requireApiKeyOrSession } from "@/lib/developer-auth";

export async function GET(request: Request): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  return json({ brands: listOwnedBrands(identity.user.id).map(({ id, name, website, industry, aliases, createdAt }) => ({ id, name, website, industry, aliases, createdAt })) });
}
