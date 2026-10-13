import { getOwnedBrand } from "@/lib/brand-access";
import { getProviders } from "@/lib/providers/registry";
import { createTrackingRun, runTracking } from "@/lib/tracking";
import { consumeApiKeyTrackingRun } from "@/lib/api-keys";
import { requireApiKeyOrSession } from "@/lib/developer-auth";
import { error, json } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  const brand = getOwnedBrand(brandId, identity.user.id);
  if (!brand) return error("Brand not found.", 404);
  if (identity.apiKeyId && !consumeApiKeyTrackingRun(identity.apiKeyId)) return error("This API key reached its daily tracking-run limit (5). Try again tomorrow.", 429);
  const providers = getProviders();
  const run = createTrackingRun(brandId, providers);
  void runTracking(run.runId, brand, providers);
  return json({ ...run, hasSimulated: providers.some((provider) => provider.isMock) }, 202);
}
