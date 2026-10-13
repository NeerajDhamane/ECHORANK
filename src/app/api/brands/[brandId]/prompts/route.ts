import { getCompetitors, getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { createPrompt, getBrandTopics, listPrompts } from "@/lib/prompt-access";
import { promptCreateSchema, promptListQuerySchema } from "@/lib/prompt-validation";
import { generatePromptSuggestions } from "@/lib/prompt-suggestions";

type Context = { params: Promise<{ brandId: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  const brand = getOwnedBrand(brandId, user.id);
  if (!brand) return error("Brand not found.", 404);
  const url = new URL(request.url);
  const parsedQuery = promptListQuerySchema.safeParse({
    ...(url.searchParams.has("status") ? { status: url.searchParams.get("status") } : {}),
    ...(url.searchParams.has("suggest") ? { suggest: url.searchParams.get("suggest") } : {}),
  });
  if (!parsedQuery.success) return error("Invalid prompt filters.", 400);
  if (parsedQuery.data.suggest === "1") {
    return json(generatePromptSuggestions({
      brand: brand.name, industry: brand.industry, competitors: getCompetitors(brandId).map(({ id, name }) => ({ id, name })),
      existingPrompts: listPrompts(brandId).map(({ text }) => text),
    }));
  }
  return json({ prompts: listPrompts(brandId, parsedQuery.data.status), topics: getBrandTopics(brandId) });
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = promptCreateSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide valid prompt details.", 400);
  const prompt = createPrompt(brandId, parsed.data);
  return prompt ? json(prompt, 201) : error("Topic not found.", 404);
}
