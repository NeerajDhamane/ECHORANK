export type BrandRef = { id: string; name: string; aliases?: string[] | null };
export type BrandHit = { brandId: string; name: string; position: number; index: number };

type IndexedHit = Omit<BrandHit, "index"> & { firstIndex: number; inputIndex: number };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstMatchIndex(text: string, candidate: string): number | null {
  const normalized = candidate.trim();
  if (!normalized) return null;
  const matcher = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(normalized)}(?![\\p{L}\\p{N}_])`, "iu");
  return matcher.exec(text)?.index ?? null;
}

/** Find each brand once, ranking brands by the first canonical-name or alias match. */
export function detectBrands(text: string, brands: BrandRef[]): BrandHit[] {
  const found: IndexedHit[] = [];
  brands.forEach((brand, inputIndex) => {
    const candidates = [brand.name, ...(brand.aliases ?? [])];
    const uniqueCandidates = [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
    const firstIndex = uniqueCandidates.reduce<number | null>((earliest, candidate) => {
      const index = firstMatchIndex(text, candidate);
      return index !== null && (earliest === null || index < earliest) ? index : earliest;
    }, null);
    if (firstIndex !== null) found.push({ brandId: brand.id, name: brand.name, position: 0, firstIndex, inputIndex });
  });

  found.sort((a, b) => a.firstIndex - b.firstIndex || a.inputIndex - b.inputIndex);
  return found.map(({ brandId, name, firstIndex }, index) => ({ brandId, name, position: index + 1, index: firstIndex }));
}
