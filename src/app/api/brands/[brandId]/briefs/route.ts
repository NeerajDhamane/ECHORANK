import { z } from "zod";
import { authenticatedUser } from "@/lib/api-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { generateAndSaveBrief, getBriefContext } from "@/lib/briefs";
import { error, json } from "@/lib/http";

type Context = { params: Promise<{ brandId: string }> };
const requestSchema = z.object({ promptId: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  const brand = getOwnedBrand(brandId, user.id);
  if (!brand) return error("Brand not found.", 404);
  let body: unknown;
  try { body = await request.json(); } catch { return error("Invalid request body.", 400); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return error("Please provide a valid prompt ID.", 400);
  const context = getBriefContext(brandId, parsed.data.promptId);
  if (!context) return error("Active prompt not found.", 404);
  return json(await generateAndSaveBrief(brand, context));
}
