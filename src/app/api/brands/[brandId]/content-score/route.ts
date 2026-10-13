import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { scoreAndSaveContent } from "@/lib/content-scores";
import { contentScoreSchema } from "@/lib/content-score-validation";

type Context = { params: Promise<{ brandId: string }> };
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = contentScoreSchema.safeParse(body.value);
  if (!parsed.success) return error("Provide pasted content to score (URLs are not supported yet).", 400);
  return json(scoreAndSaveContent(brandId, parsed.data.content, parsed.data.label));
}
