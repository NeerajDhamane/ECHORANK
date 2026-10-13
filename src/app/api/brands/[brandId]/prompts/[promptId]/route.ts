import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { getOwnedPrompt, softDeletePrompt, updatePrompt } from "@/lib/prompt-access";
import { promptPatchSchema } from "@/lib/prompt-validation";

type Context = { params: Promise<{ brandId: string; promptId: string }> };

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId, promptId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  if (!getOwnedPrompt(brandId, promptId)) return error("Prompt not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = promptPatchSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide valid prompt fields.", 400);
  const prompt = updatePrompt(brandId, promptId, parsed.data);
  return prompt ? json(prompt) : error("Prompt or topic not found.", 404);
}

export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId, promptId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  if (!getOwnedPrompt(brandId, promptId)) return error("Prompt not found.", 404);
  return softDeletePrompt(brandId, promptId) ? new Response(null, { status: 204 }) : error("Prompt not found.", 404);
}
