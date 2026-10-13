import { notFound } from "next/navigation";
import { TrackingPanel } from "@/components/tracking-panel";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";

export default async function OverviewPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  return <div className="workspace-page">
    <div className="page-heading"><p className="eyebrow">BRAND WORKSPACE</p><h1>Overview</h1><p>Collect and review evidence from AI answers about your brand.</p></div>
    <TrackingPanel brandId={brandId} />
  </div>;
}
