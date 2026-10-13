import { createMcpHandler } from "@modelcontextprotocol/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { createEchoRankMcpServer } from "@/lib/mcp-tools";
import { error } from "@/lib/http";

const handler = createMcpHandler((context) => {
  const userId = context.authInfo?.scopes.find((scope) => scope.startsWith("echorank:user:"))?.slice("echorank:user:".length);
  const apiKeyId = context.authInfo?.clientId;
  if (!userId || !apiKeyId) return createEchoRankMcpServer("", "");
  return createEchoRankMcpServer(userId, apiKeyId);
}, { legacy: "stateless" });

async function handle(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");
  const match = authorization ? /^Bearer (er_[A-Za-z0-9_-]{32})$/u.exec(authorization) : null;
  const identity = match ? authenticateApiKey(match[1]) : null;
  if (!identity) return error("Invalid API key.", 401);
  return handler.fetch(request, { authInfo: { token: "api-key-verified", clientId: identity.id, scopes: [`echorank:user:${identity.userId}`] } });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
