import { notFound } from "next/navigation";
import { ReportWorkspace } from "@/components/report-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { createReportData, listReportShares } from "@/lib/reports";
import { getCurrentUser } from "@/lib/require-auth";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ brandId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  const brand = user ? getOwnedBrand(brandId, user.id) : null;
  if (!brand) notFound();
  const raw = await searchParams;
  const values = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] ?? "" : value]]));
  const parsed = overviewQuerySchema.safeParse(values);
  const query = parsed.success ? parsed.data : overviewQuerySchema.parse({ range: "30d" });
  const scope = overviewScope(brandId, query);
  const data = createReportData(brand, scope);
  const filters = { range: query.range, ...(query.from ? { from: query.from.slice(0, 10) } : {}), ...(query.to ? { to: query.to.slice(0, 10) } : {}), ...(query.platform ? { platform: query.platform } : {}), ...(query.promptId ? { promptId: query.promptId } : {}), ...(query.tagId ? { tagId: query.tagId } : {}), ...(query.locale ? { locale: query.locale } : {}), includeSimulated: query.includeSimulated === "true" };
  return <ReportWorkspace brandId={brandId} data={data} filters={filters} initialShares={listReportShares(brandId)} />;
}
