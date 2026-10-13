import { notFound } from "next/navigation";
import { PromptManager } from "@/components/prompt-manager";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";
import { generatePromptSuggestions } from "@/lib/prompt-suggestions";
import { getCompetitors } from "@/lib/brand-access";
import { getBrandTopics, listPrompts } from "@/lib/prompt-access";
import { listPromptTags, listTags } from "@/lib/tags";

export default async function PromptsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  const brand = user ? getOwnedBrand(brandId, user.id) : null;
  if (!user || !brand) notFound();
  const prompts = listPrompts(brandId);
  const topics = getBrandTopics(brandId);
  const suggestions = generatePromptSuggestions({
    brand: brand.name,
    industry: brand.industry,
    competitors: getCompetitors(brandId).map(({ id, name }) => ({ id, name })),
    existingPrompts: prompts.map(({ text }) => text),
  });
  return <PromptManager brandId={brandId} initialPrompts={prompts} initialTopics={topics} suggestions={suggestions} initialTags={listTags(user.id)} initialPromptTags={listPromptTags(brandId, user.id)} />;
}
