import { AuthenticationRequiredError, requireAuth } from "@/lib/require-auth";
import { error } from "@/lib/http";

export async function authenticatedUser() {
  try { return { user: await requireAuth(), response: null }; }
  catch (cause) {
    if (cause instanceof AuthenticationRequiredError) return { user: null, response: error("Authentication required.", 401) };
    return { user: null, response: error("Unable to authenticate request.", 500) };
  }
}

export async function readJson(request: Request): Promise<{ value: unknown; response: null } | { value: null; response: Response }> {
  try { return { value: await request.json() as unknown, response: null }; }
  catch { return { value: null, response: error("Invalid request body.", 400) }; }
}
