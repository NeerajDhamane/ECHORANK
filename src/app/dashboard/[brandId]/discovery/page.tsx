import { notFound } from "next/navigation";
import { DiscoveryWorkspace } from "@/components/discovery-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { listDiscoveryItems } from "@/lib/discovery";
import { getSqlite } from "@/db";
import { getCurrentUser } from "@/lib/require-auth";

export default async function DiscoveryPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  const prompts = getSqlite().prepare("SELECT id, text FROM prompts WHERE brand_id = @brandId AND status = 'active' AND deleted_at IS NULL").all({ brandId }) as Array<{ id: string; text: string }>;
  return <DiscoveryWorkspace brandId={brandId} prompts={prompts} initialItems={listDiscoveryItems(brandId, undefined)} hasReddit={Boolean(process.env.REDDIT_CLIENT_ID?.trim() && process.env.REDDIT_CLIENT_SECRET?.trim())} />;
}
