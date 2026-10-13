import { notFound } from "next/navigation";
import { BriefWorkspace } from "@/components/brief-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";
import { getSqlite } from "@/db";

export default async function BriefsPage({ params, searchParams }: { params: Promise<{ brandId: string }>; searchParams: Promise<{ promptId?: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  const brand = user ? getOwnedBrand(brandId, user.id) : null;
  if (!brand) notFound();
  const query = await searchParams;
  const prompts = getSqlite().prepare("SELECT id, text FROM prompts WHERE brand_id = @brandId AND status = 'active' AND deleted_at IS NULL ORDER BY text").all({ brandId }) as Array<{ id: string; text: string }>;
  const initialPromptId = prompts.some((prompt) => prompt.id === query.promptId) ? query.promptId! : prompts[0]?.id ?? "";
  return <BriefWorkspace brandId={brandId} prompts={prompts} initialPromptId={initialPromptId} />;
}
