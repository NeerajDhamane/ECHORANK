import { z } from "zod";
import { authenticatedUser } from "@/lib/api-auth";
import { revokeUserApiKey } from "@/lib/api-keys";
import { error, json } from "@/lib/http";

const idSchema = z.string().uuid();
export async function DELETE(_request: Request, { params }: { params: Promise<{ keyId: string }> }): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { keyId } = await params;
  if (!idSchema.safeParse(keyId).success || !revokeUserApiKey(user.id, keyId)) return error("API key not found.", 404);
  return json({ revoked: true });
}
