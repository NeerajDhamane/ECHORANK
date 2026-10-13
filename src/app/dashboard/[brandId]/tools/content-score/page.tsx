import { notFound } from "next/navigation";
import { ContentScoreWorkspace } from "@/components/content-score-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getContentScoreHistory } from "@/lib/content-scores";
import { getCurrentUser } from "@/lib/require-auth";

export default async function ContentScorePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  return <ContentScoreWorkspace brandId={brandId} initialHistory={getContentScoreHistory(brandId)} />;
}
