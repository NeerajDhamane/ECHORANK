import { notFound } from "next/navigation";
import { CrawlAuditWorkspace } from "@/components/crawl-audit-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCrawlAuditHistory } from "@/lib/crawl-audit";
import { getCurrentUser } from "@/lib/require-auth";

export default async function CrawlAuditPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  return <CrawlAuditWorkspace brandId={brandId} initialHistory={getCrawlAuditHistory(brandId)} />;
}
