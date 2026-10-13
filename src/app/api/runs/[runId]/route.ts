import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { getRunStatus } from "@/lib/tracking";

type Context = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { runId } = await params;
  const run = getRunStatus(runId);
  if (!run || !getOwnedBrand(run.brandId, user.id)) return error("Run not found.", 404);
  const { runId: id, status, startedAt, finishedAt, totalExpected, completed, simulatedCount } = run;
  return json({ runId: id, status, startedAt, finishedAt, totalExpected, completed, simulatedCount });
}
