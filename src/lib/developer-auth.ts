import { authenticatedUser } from "@/lib/api-auth";
import { authenticateApiKey } from "@/lib/api-keys";
import { error } from "@/lib/http";

export type DeveloperIdentity = { user: { id: string; name: string; email: string }; apiKeyId: string | null };

export async function requireApiKeyOrSession(request: Request, verifyKey = authenticateApiKey): Promise<{ identity: DeveloperIdentity | null; response: Response | null }> {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer (er_[A-Za-z0-9_-]{32})$/u.exec(authorization);
    if (!match) return { identity: null, response: error("Invalid API key.", 401) };
    const key = verifyKey(match[1]);
    if (!key) return { identity: null, response: error("Invalid API key.", 401) };
    return { identity: { user: { id: key.userId, name: "API user", email: "" }, apiKeyId: key.id }, response: null };
  }
  const { user, response } = await authenticatedUser();
  return user ? { identity: { user, apiKeyId: null }, response: null } : { identity: null, response: response ?? error("Authentication required.", 401) };
}

export function mcpAuthInfo(request: Request, userId: string, apiKeyId: string) {
  const token = request.headers.get("authorization")?.slice("Bearer ".length) ?? "authenticated";
  return { token, clientId: apiKeyId, scopes: [`echorank:user:${userId}`] };
}
