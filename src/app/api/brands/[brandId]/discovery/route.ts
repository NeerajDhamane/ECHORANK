import { z } from "zod";
import { authenticatedUser } from "@/lib/api-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { error, json } from "@/lib/http";
import { listDiscoveryItems } from "@/lib/discovery";

type Context = { params: Promise<{ brandId: string }> };
const querySchema = z.object({ status: z.enum(["new", "saved", "dismissed"]).optional() }).strict();

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Invalid discovery filter.", 400);
  return json(listDiscoveryItems(brandId, parsed.data.status));
}
