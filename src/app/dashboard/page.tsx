import { redirect } from "next/navigation";
import { BrandDashboard } from "@/components/brand-dashboard";
import { getCurrentUser } from "@/lib/require-auth";
import { listOwnedBrands } from "@/lib/brand-access";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <BrandDashboard initialBrands={listOwnedBrands(user.id)} />;
}
