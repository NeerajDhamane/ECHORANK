import { z } from "zod";
import { getOwnedBrand } from "@/lib/brand-access";
import { listRecommendations } from "@/lib/recommendations";
import { requireApiKeyOrSession } from "@/lib/developer-auth";
import { error, json } from "@/lib/http";

const querySchema = z.object({ includeDone: z.enum(["true", "false"]).optional().default("false") }).strict();
export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, identity.user.id)) return error("Brand not found.", 404);
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Invalid recommendation filters.", 400);
  return json(listRecommendations(brandId, parsed.data.includeDone === "true"));
}
