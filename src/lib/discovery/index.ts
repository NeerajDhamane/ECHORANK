import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getSqlite } from "@/db";
import type { DiscoveryItem, DiscoverySource } from "./types";
import { toQuery, rankHits } from "./rank";
import { createHnSource } from "./hn";
import { createStackExchangeSource } from "./stackexchange";
import { createRedditSource } from "./reddit";
import { DISCOVERY_USER_AGENT, type DiscoveryCredentials, type DiscoveryFetch } from "./types-private";

const wait = async (milliseconds: number): Promise<void> => { await new Promise((resolve) => setTimeout(resolve, milliseconds)); };

function pacedFetch(fetcher: DiscoveryFetch, pause: (milliseconds: number) => Promise<void>): DiscoveryFetch {
  let requests = 0;
  return async (input, init) => {
    if (requests > 0) await pause(1000);
    requests += 1;
    const headers = new Headers(init?.headers);
    if (!headers.has("User-Agent")) headers.set("User-Agent", DISCOVERY_USER_AGENT);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (method !== "GET" && !(method === "POST" && String(input) === "https://www.reddit.com/api/v1/access_token")) throw new Error("Discovery sources only support GET requests (Reddit OAuth token POST is the sole exception).");
    return fetcher(input, { ...init, headers });
  };
}

export function createDiscoverySources(options: { env?: DiscoveryCredentials; fetcher?: DiscoveryFetch; pause?: (milliseconds: number) => Promise<void> } = {}): DiscoverySource[] {
  const env = options.env ?? { REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET };
  const fetcher = pacedFetch(options.fetcher ?? fetch, options.pause ?? wait);
  const sources: DiscoverySource[] = [createHnSource(fetcher), createStackExchangeSource(fetcher)];
  const reddit = createRedditSource(env, fetcher);
  if (reddit) sources.push(reddit);
  return sources;
}

export function listDiscoveryItems(brandId: string, status: "new" | "saved" | "dismissed" | undefined, database: Database.Database = getSqlite()): DiscoveryItem[] {
  const rows = status
    ? database.prepare("SELECT id, prompt_id AS promptId, platform, title, url, subreddit, score, num_comments AS numComments, relevance, status, found_at AS foundAt FROM discovery_items WHERE brand_id = @brandId AND status = @status ORDER BY relevance DESC, found_at DESC LIMIT 200").all({ brandId, status })
    : database.prepare("SELECT id, prompt_id AS promptId, platform, title, url, subreddit, score, num_comments AS numComments, relevance, status, found_at AS foundAt FROM discovery_items WHERE brand_id = @brandId ORDER BY relevance DESC, found_at DESC LIMIT 200").all({ brandId });
  return rows as DiscoveryItem[];
}

export function updateDiscoveryStatus(brandId: string, itemId: string, status: "saved" | "dismissed", database: Database.Database = getSqlite()): boolean {
  const result = database.prepare("UPDATE discovery_items SET status = @status WHERE id = @itemId AND brand_id = @brandId").run({ brandId, itemId, status });
  return result.changes > 0;
}

export async function refreshDiscovery(brandId: string, options: { sources?: DiscoverySource[]; database?: Database.Database; now?: () => number } = {}) {
  const database = options.database ?? getSqlite();
  const sources = options.sources ?? createDiscoverySources();
  const prompts = database.prepare("SELECT id, text FROM prompts WHERE brand_id = @brandId AND status = 'active' AND deleted_at IS NULL ORDER BY created_at, id LIMIT 10").all({ brandId }) as Array<{ id: string; text: string }>;
  const competitors = database.prepare("SELECT name FROM brands WHERE owner_brand_id = @brandId AND deleted_at IS NULL ORDER BY name").all({ brandId }) as Array<{ name: string }>;
  const upsert = database.prepare(`INSERT INTO discovery_items (id, brand_id, prompt_id, platform, title, url, subreddit, score, num_comments, relevance)
    VALUES (@id, @brandId, @promptId, @platform, @title, @url, @community, @score, @comments, @relevance)
    ON CONFLICT(brand_id, url) DO UPDATE SET prompt_id=excluded.prompt_id, platform=excluded.platform, title=excluded.title,
      subreddit=excluded.subreddit, score=excluded.score, num_comments=excluded.num_comments, relevance=excluded.relevance`);
  let found = 0;
  let failures = 0;
  for (const prompt of prompts) {
    const query = toQuery(prompt.text);
    if (!query) continue;
    for (const source of sources) {
      try {
        const hits = await source.search(query);
        const ranked = rankHits(hits, competitors.map(({ name }) => name), (options.now ?? Date.now)());
        for (const hit of ranked) {
          let parsed: URL;
          try { parsed = new URL(hit.url); } catch { continue; }
          if (!["https:", "http:"].includes(parsed.protocol) || !hit.title.trim()) continue;
          upsert.run({ id: randomUUID(), brandId, promptId: prompt.id, platform: source.id, title: hit.title.slice(0, 500), url: parsed.toString(), community: hit.community?.slice(0, 120) ?? source.id, score: Math.trunc(hit.score), comments: Math.trunc(hit.comments), relevance: hit.relevance });
          found += 1;
        }
      } catch { failures += 1; }
    }
  }
  return { promptsSearched: prompts.filter((prompt) => toQuery(prompt.text)).length, itemsFound: found, sourceFailures: failures, sources: sources.map(({ id }) => id) };
}
