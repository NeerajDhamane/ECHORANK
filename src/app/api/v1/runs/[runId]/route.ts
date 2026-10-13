import { getOwnedBrand } from "@/lib/brand-access";
import { getRunStatus } from "@/lib/tracking";
import { requireApiKeyOrSession } from "@/lib/developer-auth";
import { error, json } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }): Promise<Response> {
  const { identity, response } = await requireApiKeyOrSession(request);
  if (!identity) return response ?? error("Authentication required.", 401);
  const { runId } = await params;
  const run = getRunStatus(runId);
  if (!run || !getOwnedBrand(run.brandId, identity.user.id)) return error("Run not found.", 404);
  const { runId: id, status, startedAt, finishedAt, totalExpected, completed, simulatedCount } = run;
  return json({ runId: id, status, startedAt, finishedAt, totalExpected, completed, simulatedCount });
}
