import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { getOwnedPrompt } from "@/lib/prompt-access";
import { attachPromptTag, detachPromptTag } from "@/lib/tags";
import { tagLinkSchema } from "@/lib/tag-validation";

type Context = { params: Promise<{ brandId: string; promptId: string }> };
async function authorize(brandId: string, promptId: string) {
  const { user, response } = await authenticatedUser();
  if (response || !user) return { user: null, response: response ?? error("Authentication required.", 401) };
  if (!getOwnedBrand(brandId, user.id)) return { user: null, response: error("Brand not found.", 404) };
  if (!getOwnedPrompt(brandId, promptId)) return { user: null, response: error("Prompt not found.", 404) };
  return { user, response: null };
}
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { brandId, promptId } = await params;
  const access = await authorize(brandId, promptId);
  if (access.response || !access.user) return access.response ?? error("Authentication required.", 401);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = tagLinkSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid tag id.", 400);
  return attachPromptTag(brandId, access.user.id, promptId, parsed.data.tagId) ? json({ ok: true }) : error("Tag not found.", 404);
}
export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const { brandId, promptId } = await params;
  const access = await authorize(brandId, promptId);
  if (access.response || !access.user) return access.response ?? error("Authentication required.", 401);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = tagLinkSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid tag id.", 400);
  return detachPromptTag(brandId, access.user.id, promptId, parsed.data.tagId) ? new Response(null, { status: 204 }) : error("Tag not found.", 404);
}
