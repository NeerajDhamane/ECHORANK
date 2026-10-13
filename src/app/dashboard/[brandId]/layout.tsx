import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentUser } from "@/lib/require-auth";
import { getOwnedBrand } from "@/lib/brand-access";

export default async function BrandLayout({ children, params }: { children: ReactNode; params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  const brand = user ? getOwnedBrand(brandId, user.id) : null;
  if (!brand) notFound();
  return <WorkspaceShell brandId={brandId} brandName={brand.name}>{children}</WorkspaceShell>;
}
