import type { DiscoverySource } from "./types";
import { DISCOVERY_USER_AGENT, readJson, toIsoDate, type DiscoveryFetch } from "./types-private";

type HnResult = { hits?: Array<{ title?: string; objectID?: string; points?: number | null; num_comments?: number | null; created_at?: string }> };

export function createHnSource(fetcher: DiscoveryFetch = fetch): DiscoverySource {
  return {
    id: "hn",
    async search(query) {
      const url = new URL("https://hn.algolia.com/api/v1/search");
      url.searchParams.set("query", query); url.searchParams.set("tags", "story"); url.searchParams.set("hitsPerPage", "25");
      const data = await readJson<HnResult>(await fetcher(url, { method: "GET", headers: { "User-Agent": DISCOVERY_USER_AGENT } }));
      return (data.hits ?? []).flatMap((hit) => hit.title && hit.objectID ? [{
        title: hit.title, url: `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`, community: "Hacker News",
        score: hit.points ?? 0, comments: hit.num_comments ?? 0, createdAt: toIsoDate(undefined, hit.created_at),
      }] : []);
    },
  };
}
