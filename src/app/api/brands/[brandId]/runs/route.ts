import { z } from "zod";
import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { getRecentRuns } from "@/lib/tracking";

type Context = { params: Promise<{ brandId: string }> };
const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).optional().default(10) }).strict();

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return error("Invalid run filters.", 400);
  return json({ runs: getRecentRuns(brandId, parsed.data.limit) });
}
