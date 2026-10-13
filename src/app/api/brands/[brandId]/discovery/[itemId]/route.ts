import { z } from "zod";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { error, json } from "@/lib/http";
import { updateDiscoveryStatus } from "@/lib/discovery";

type Context = { params: Promise<{ brandId: string; itemId: string }> };
const statusSchema = z.object({ status: z.enum(["saved", "dismissed"]) }).strict();

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId, itemId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = statusSchema.safeParse(body.value);
  if (!parsed.success) return error("Invalid discovery status.", 400);
  if (!updateDiscoveryStatus(brandId, itemId, parsed.data.status)) return error("Discovery item not found.", 404);
  return json({ id: itemId, status: parsed.data.status });
}
