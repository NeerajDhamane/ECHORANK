import { notFound } from "next/navigation";
import { LlmsTxtWorkspace } from "@/components/llms-txt-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";

export default async function LlmsTxtPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  const brand = user ? getOwnedBrand(brandId, user.id) : null;
  if (!user || !brand) notFound();
  return <LlmsTxtWorkspace brandId={brandId} brandName={brand.name} />;
}
