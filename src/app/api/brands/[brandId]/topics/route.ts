import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { createTopic, TopicConflictError } from "@/lib/prompt-access";
import { topicCreateSchema } from "@/lib/prompt-validation";

type Context = { params: Promise<{ brandId: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = topicCreateSchema.safeParse(body.value);
  if (!parsed.success) return error("Please provide a valid topic name.", 400);
  try { return json(createTopic(brandId, parsed.data.name), 201); }
  catch (cause) {
    if (cause instanceof TopicConflictError) return error(cause.message, 409);
    return error("Unable to create topic.", 500);
  }
}
