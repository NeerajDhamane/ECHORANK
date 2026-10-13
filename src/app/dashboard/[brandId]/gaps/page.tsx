import { notFound } from "next/navigation";
import { GapsWorkspace } from "@/components/gaps-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";
import { overviewQuerySchema, overviewScope } from "@/lib/overview";
import { gapOpportunities } from "@/lib/gaps";

type PageProps = {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GapsPage({ params, searchParams }: PageProps) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user || !getOwnedBrand(brandId, user.id)) notFound();
  const raw = await searchParams;
  const values = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] ?? "" : value]]));
  const parsed = overviewQuerySchema.safeParse(values);
  const query = parsed.success ? parsed.data : overviewQuerySchema.parse({});
  const scope = overviewScope(brandId, query);
  return <GapsWorkspace items={gapOpportunities(scope)} simulatedIncluded={scope.includeSimulated === true} />;
}
