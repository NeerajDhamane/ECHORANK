import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/require-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { DeveloperWorkspace } from "@/components/developer-workspace";

export default async function DeveloperPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  return <DeveloperWorkspace />;
}
