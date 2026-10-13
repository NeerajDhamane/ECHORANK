import type { DiscoverySource } from "./types";
import { DISCOVERY_USER_AGENT, readJson, toIsoDate, type DiscoveryCredentials, type DiscoveryFetch } from "./types-private";

type RedditToken = { access_token?: string };
type RedditResult = { data?: { children?: Array<{ data?: { title?: string; permalink?: string; subreddit_name_prefixed?: string; score?: number; num_comments?: number; created_utc?: number; selftext?: string } }> } };

export function createRedditSource(credentials: DiscoveryCredentials, fetcher: DiscoveryFetch = fetch): DiscoverySource | null {
  const id = credentials.REDDIT_CLIENT_ID?.trim();
  const secret = credentials.REDDIT_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  let token: string | null = null;
  return {
    id: "reddit",
    async search(query) {
      if (!token) {
        const basic = Buffer.from(`${id}:${secret}`).toString("base64");
        const response = await fetcher("https://www.reddit.com/api/v1/access_token", {
          method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": DISCOVERY_USER_AGENT },
          body: "grant_type=client_credentials",
        });
        const data = await readJson<RedditToken>(response);
        if (!data.access_token) throw new Error("Reddit did not return an access token");
        token = data.access_token;
      }
      const url = new URL("https://oauth.reddit.com/search");
      url.searchParams.set("q", query); url.searchParams.set("sort", "relevance"); url.searchParams.set("t", "year"); url.searchParams.set("limit", "25"); url.searchParams.set("type", "link");
      const data = await readJson<RedditResult>(await fetcher(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, "User-Agent": DISCOVERY_USER_AGENT } }));
      return (data.data?.children ?? []).flatMap(({ data: item }) => item?.title && item.permalink ? [{
        title: item.title, url: `https://www.reddit.com${item.permalink}`, community: item.subreddit_name_prefixed ?? "Reddit",
        score: item.score ?? 0, comments: item.num_comments ?? 0, createdAt: toIsoDate(item.created_utc), text: item.selftext?.slice(0, 2000),
      }] : []);
    },
  };
}
