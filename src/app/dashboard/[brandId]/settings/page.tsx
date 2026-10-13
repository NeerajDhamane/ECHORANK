import { notFound } from "next/navigation";
import { BrandSettings } from "@/components/brand-settings";
import { getCompetitors, getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";

export default async function SettingsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  const brand = user ? getOwnedBrand(brandId, user.id) : null;
  if (!brand) notFound();
  return <BrandSettings brand={brand} initialCompetitors={getCompetitors(brand.id)} />;
}
