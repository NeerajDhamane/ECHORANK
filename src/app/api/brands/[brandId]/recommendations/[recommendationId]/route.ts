import { z } from "zod";
import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { updateRecommendationStatus } from "@/lib/recommendations";

type Context = { params: Promise<{ brandId: string; recommendationId: string }> };
const statusSchema = z.object({ status: z.enum(["open", "in_progress", "done"]) }).strict();

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId, recommendationId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = statusSchema.safeParse(body.value);
  if (!parsed.success) return error("Invalid recommendation status.", 400);
  if (!updateRecommendationStatus(brandId, recommendationId, parsed.data.status)) return error("Recommendation not found.", 404);
  return json({ id: recommendationId, status: parsed.data.status });
}
