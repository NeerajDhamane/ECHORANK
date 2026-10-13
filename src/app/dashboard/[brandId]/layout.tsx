import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentUser } from "@/lib/require-auth";
import { getOwnedBrand } from "@/lib/brand-access";
import { getSqlite } from "@/db";
import { unreadAlertCount } from "@/lib/alerts";
import { countryNameForLocale } from "@/lib/locales";

export default async function BrandLayout({ children, params }: { children: ReactNode; params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  const brand = user ? getOwnedBrand(brandId, user.id) : null;
  if (!user || !brand) notFound();
  const database = getSqlite();
  const platforms = database.prepare("SELECT DISTINCT platform FROM chats WHERE brand_id = @brandId ORDER BY platform").all({ brandId }) as Array<{ platform: string }>;
  const locales = database.prepare("SELECT DISTINCT locale FROM chats WHERE brand_id = @brandId AND locale IS NOT NULL ORDER BY locale").all({ brandId }) as Array<{ locale: string }>;
  const tags = database.prepare("SELECT id, name FROM tags WHERE user_id = @userId ORDER BY name").all({ userId: user.id }) as Array<{ id: string; name: string }>;
  const localeOptions = locales.map(({ locale }) => ({ id: locale, name: locale.toLowerCase() === "global" ? "Global" : `${countryNameForLocale(locale) ?? locale} (${locale.toUpperCase()})` }));
  const filterOptions = { platforms: platforms.map(({ platform }) => platform), locales: localeOptions, tags };
  return <WorkspaceShell brandId={brandId} brandName={brand.name} filterOptions={filterOptions} unreadAlerts={unreadAlertCount(brandId)}>{children}</WorkspaceShell>;
}
