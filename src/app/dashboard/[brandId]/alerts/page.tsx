import { notFound } from "next/navigation";
import { AlertsWorkspace } from "@/components/alerts-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";
import { getAlertSettings, listAlerts } from "@/lib/alerts";

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  const initialAlerts = listAlerts(brandId);
  const initialRules = getAlertSettings(brandId);
  return <AlertsWorkspace brandId={brandId} initialAlerts={initialAlerts} initialRules={initialRules} />;
}
