import { notFound } from "next/navigation";
import { ChatsWorkspace } from "@/components/chats-workspace";
import { getOwnedBrand } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/require-auth";
import { getChatPage, parseChatsQuery } from "@/lib/chats";

type PageProps = {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChatsPage({ params, searchParams }: PageProps) {
  const { brandId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const ownBrand = getOwnedBrand(brandId, user.id);
  if (!ownBrand) notFound();
  const raw = await searchParams;
  const query = new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] ?? "" : value]]));
  const parsed = parseChatsQuery(query, brandId);
  const scope = parsed.success ? parsed.data.scope : { brandId };
  const page = parsed.success ? parsed.data.page : 1;
  const limit = parsed.success ? parsed.data.limit : 50;
  return <ChatsWorkspace brandId={brandId} ownBrand={{ id: ownBrand.id, name: ownBrand.name }} initialData={getChatPage(scope, page, limit)} />;
}
