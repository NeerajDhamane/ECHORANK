import { getOwnedBrand } from "@/lib/brand-access";
import { getBrandTopics, listPrompts, createPrompt } from "@/lib/prompt-access";
import { promptCreateSchema, promptListQuerySchema } from "@/lib/prompt-validation";
import { requireApiKeyOrSession } from "@/lib/developer-auth";
import { error, json } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, identity.user.id)) return error("Brand not found.", 404);
  const parsed = promptListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success || parsed.data.suggest) return error("Invalid prompt filters.", 400);
  return json({ prompts: listPrompts(brandId, parsed.data.status), topics: getBrandTopics(brandId) });
}

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, identity.user.id)) return error("Brand not found.", 404);
  let raw: unknown;
  try { raw = await request.json(); } catch { return error("Invalid request body."); }
  const parsed = promptCreateSchema.safeParse(raw);
  if (!parsed.success) return error("Please provide valid prompt details.");
  const prompt = createPrompt(brandId, parsed.data);
  return prompt ? json(prompt, 201) : error("Topic not found.", 404);
}
