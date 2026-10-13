import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { getProviders } from "@/lib/providers/registry";
import { createTrackingRun, runTracking } from "@/lib/tracking";

type Context = { params: Promise<{ brandId: string }> };

export async function POST(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  const brand = getOwnedBrand(brandId, user.id);
  if (!brand) return error("Brand not found.", 404);

  const providers = getProviders();
  const run = createTrackingRun(brandId, providers);
  void runTracking(run.runId, brand, providers);
  return json({ ...run, hasSimulated: providers.some((provider) => provider.isMock) }, 202);
}
