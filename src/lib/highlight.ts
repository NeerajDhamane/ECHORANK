export type HighlightBrand = { id: string; name: string; aliases?: string[] };
export type HighlightSegment = { text: string; brandId: string | null; isOwnBrand: boolean };
type Hit = { start: number; end: number; brandId: string; isOwnBrand: boolean };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split answer text into escaped-renderable text segments and detected brand mentions. */
export function highlightText(text: string, brands: HighlightBrand[], ownBrandId: string): HighlightSegment[] {
  const hits: Hit[] = [];
  for (const brand of brands) {
    const candidates = new Set([brand.name, ...(brand.aliases ?? [])].map((value) => value.trim()).filter(Boolean));
    for (const candidate of candidates) {
      const matcher = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(candidate)}(?![\\p{L}\\p{N}_])`, "giu");
      for (const match of text.matchAll(matcher)) {
        const start = match.index ?? 0;
        hits.push({ start, end: start + match[0].length, brandId: brand.id, isOwnBrand: brand.id === ownBrandId });
      }
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end || Number(b.isOwnBrand) - Number(a.isOwnBrand));
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) segments.push({ text: text.slice(cursor, hit.start), brandId: null, isOwnBrand: false });
    segments.push({ text: text.slice(hit.start, hit.end), brandId: hit.brandId, isOwnBrand: hit.isOwnBrand });
    cursor = hit.end;
  }
  if (cursor < text.length || segments.length === 0) segments.push({ text: text.slice(cursor), brandId: null, isOwnBrand: false });
  return segments;
}
