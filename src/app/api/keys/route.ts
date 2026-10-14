import { z } from "zod";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { createUserApiKey, listUserApiKeys } from "@/lib/api-keys";
import { error, json } from "@/lib/http";

const createSchema = z.object({ label: z.string().trim().min(1).max(60) }).strict();

export async function GET(): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  return json({ keys: listUserApiKeys(user.id) });
}

export async function POST(request: Request): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const body = await readJson(request);
  if (body.response) return body.response;
  const parsed = createSchema.safeParse(body.value);
  if (!parsed.success) return error("Provide a key label up to 60 characters.");
  const created = createUserApiKey(user.id, parsed.data.label);
  return json({ id: created.id, token: created.token, label: created.label, createdAt: created.createdAt }, 201);
}
