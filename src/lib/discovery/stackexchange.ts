import type { DiscoverySource } from "./types";
import { DISCOVERY_USER_AGENT, readJson, toIsoDate, type DiscoveryFetch } from "./types-private";

type StackResult = { items?: Array<{ title?: string; link?: string; score?: number; answer_count?: number; creation_date?: number; body?: string }> };

export function createStackExchangeSource(fetcher: DiscoveryFetch = fetch, site = "stackoverflow"): DiscoverySource {
  return {
    id: "stackexchange",
    async search(query) {
      const url = new URL("https://api.stackexchange.com/2.3/search/advanced");
      url.searchParams.set("q", query); url.searchParams.set("site", site); url.searchParams.set("order", "desc"); url.searchParams.set("sort", "relevance"); url.searchParams.set("pagesize", "25");
      const data = await readJson<StackResult>(await fetcher(url, { method: "GET", headers: { "User-Agent": DISCOVERY_USER_AGENT } }));
      return (data.items ?? []).flatMap((item) => item.title && item.link && isHttpUrl(item.link) ? [{
        title: item.title, url: item.link, community: site, score: item.score ?? 0, comments: item.answer_count ?? 0,
        createdAt: toIsoDate(item.creation_date), text: item.body?.replace(/<[^>]*>/gu, " ").slice(0, 2000),
      }] : []);
    },
  };
}

function isHttpUrl(value: string) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
