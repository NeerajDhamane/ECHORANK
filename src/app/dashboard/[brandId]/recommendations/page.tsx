import { notFound } from "next/navigation";
import { RecommendationsWorkspace } from "@/components/recommendations-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";
import { listRecommendations } from "@/lib/recommendations";

export default async function RecommendationsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  return <RecommendationsWorkspace brandId={brandId} initialItems={listRecommendations(brandId, true)} />;
}
