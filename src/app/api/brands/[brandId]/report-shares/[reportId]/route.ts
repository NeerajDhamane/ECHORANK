import { authenticatedUser } from "@/lib/api-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { error, json } from "@/lib/http";
import { revokeReportShare } from "@/lib/reports";

type Context = { params: Promise<{ brandId: string; reportId: string }> };

export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId, reportId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  if (!revokeReportShare(brandId, reportId)) return error("Report share not found.", 404);
  return json({ id: reportId, revoked: true });
}
