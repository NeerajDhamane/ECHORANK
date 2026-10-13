import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function BrandLayout({ children, params }: { children: ReactNode; params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return <WorkspaceShell brandId={brandId}>{children}</WorkspaceShell>;
}
