import { notFound } from "next/navigation";
import { TrackingPanel } from "@/components/tracking-panel";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";
import { getOverview } from "@/lib/analytics";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { listPrompts } from "@/lib/prompt-access";

type PageProps = {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OverviewPage({ params, searchParams }: PageProps) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  const rawQuery = await searchParams;
  const queryValues = Object.fromEntries(Object.entries(rawQuery).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] ?? "" : value]]));
  const parsedQuery = overviewQuerySchema.safeParse(queryValues);
  const query = parsedQuery.success ? parsedQuery.data : overviewQuerySchema.parse({});
  const overview = getOverview(overviewScope(brandId, query));
  const activePromptCount = listPrompts(brandId, "active").length;
  return <div className="workspace-page">
    <div className="page-heading overview-heading"><div><p className="eyebrow">BRAND WORKSPACE</p><h1>Overview</h1><p>Collect and review evidence from AI answers about your brand.</p></div><TrackingPanel brandId={brandId} /></div>
    <OverviewDashboard brandId={brandId} overview={overview} activePromptCount={activePromptCount} />
  </div>;
}
