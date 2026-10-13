import { z } from "zod";
import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { listRecommendations } from "@/lib/recommendations";

type Context = { params: Promise<{ brandId: string }> };
const querySchema = z.object({ includeDone: z.enum(["true", "false"]).optional().default("false") }).strict();

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Invalid recommendation filters.", 400);
  return json(listRecommendations(brandId, parsed.data.includeDone === "true"));
}
