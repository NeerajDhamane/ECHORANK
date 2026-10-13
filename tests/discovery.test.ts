import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { createDiscoverySources, listDiscoveryItems, refreshDiscovery } from "@/lib/discovery";
import { rankHits, toQuery } from "@/lib/discovery/rank";
import { createRedditSource } from "@/lib/discovery/reddit";
import type { DiscoveryHit } from "@/lib/discovery/types";

describe("discovery", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; vi.restoreAllMocks(); });

  it("turns a prompt into at most six lower-case non-stopwords", () => {
    expect(toQuery("What is the best cloud host for a 10-person startup with teams?" )).toBe("cloud host 10 person startup teams");
    expect(toQuery("what is the best for a?" )).toBe("");
  });

  it("ranks by normalized log signals and applies a competitor-name boost", () => {
    const now = Date.parse("2026-10-14T00:00:00.000Z");
    const hits: DiscoveryHit[] = [
      { title: "Compare Nimbus Cloud", url: "https://example.test/1", score: 3, comments: 2, createdAt: "2026-10-13T00:00:00.000Z" },
      { title: "Cloud discussion", url: "https://example.test/2", score: 10, comments: 10, createdAt: "2026-10-13T00:00:00.000Z" },
    ];
    const result = rankHits(hits, ["Nimbus Cloud"], now);
    const boosted = result.find((hit) => "matchedCompetitor" in hit);
    expect(boosted?.matchedCompetitor).toBe("Nimbus Cloud");
    expect(boosted!.relevance).toBeCloseTo((0.5 * Math.log1p(2) / Math.log1p(10) + 0.3 * Math.log1p(3) / Math.log1p(10) + 0.2 * Math.exp(-1 / 365)) * 1.25);
  });

  it("runs HN and Stack Exchange without Reddit credentials using GET and a descriptive user agent", async () => {
    const calls: Array<{ url: string; method: string; agent: string | null }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); const method = init?.method ?? "GET";
      calls.push({ url, method, agent: new Headers(init?.headers).get("User-Agent") });
      if (url.includes("hn.algolia.com")) return Response.json({ hits: [{ title: "HN thread", objectID: "123", points: 7, num_comments: 4 }] });
      return Response.json({ items: [{ title: "Stack question", link: "https://stackoverflow.com/questions/42", score: 3, answer_count: 2, creation_date: 1_700_000_000, body: "<p>Useful body</p>" }] });
    });
    const pauses: number[] = [];
    const sources = createDiscoverySources({ env: {}, fetcher, pause: async (ms) => { pauses.push(ms); } });
    expect(sources.map(({ id }) => id)).toEqual(["hn", "stackexchange"]);
    expect(await sources[0]!.search("cloud host")).toMatchObject([{ community: "Hacker News", url: "https://news.ycombinator.com/item?id=123", score: 7, comments: 4 }]);
    expect(await sources[1]!.search("cloud host")).toMatchObject([{ community: "stackoverflow", score: 3, comments: 2, text: " Useful body " }]);
    expect(calls.every((call) => call.method === "GET" && call.agent?.includes("EchoRank/1.0"))).toBe(true);
    expect(pauses).toEqual([1000]);
  });

  it("uses only a Reddit OAuth token POST followed by a GET search when credentials exist", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); const method = init?.method ?? "GET"; calls.push({ url, method });
      return url.includes("access_token") ? Response.json({ access_token: "test-token" }) : Response.json({ data: { children: [{ data: { title: "A thread", permalink: "/r/test/comments/1/a_thread/", subreddit_name_prefixed: "r/test", score: 4, num_comments: 2 } }] } });
    });
    const source = createRedditSource({ REDDIT_CLIENT_ID: "id", REDDIT_CLIENT_SECRET: "secret" }, fetcher);
    expect(source).not.toBeNull();
    expect(await source!.search("cloud hosting")).toMatchObject([{ community: "r/test", url: "https://www.reddit.com/r/test/comments/1/a_thread/" }]);
    expect(calls.map(({ method }) => method)).toEqual(["POST", "GET"]);
    expect(calls[0]!.url).toBe("https://www.reddit.com/api/v1/access_token");
    expect(calls[1]!.url).toBe("https://oauth.reddit.com/search?q=cloud+hosting&sort=relevance&t=year&limit=25&type=link");
  });

  it("upserts by brand and URL on repeated refreshes and preserves saved status", async () => {
    database = new Database(":memory:"); migrateDatabase(database);
    database.exec(`INSERT INTO brands(id,user_id,name) VALUES ('own','u','Acme');
      INSERT INTO brands(id,user_id,owner_brand_id,name) VALUES ('rival','u','own','Nimbus Cloud');
      INSERT INTO prompts(id,brand_id,text,status) VALUES ('p','own','Best cloud hosting?', 'active');
      INSERT INTO discovery_items(id,brand_id,prompt_id,platform,title,url,status) VALUES ('old','own','p','hn','Old title','https://news.ycombinator.com/item?id=9','saved');`);
    const source = { id: "hn" as const, search: vi.fn(async (query: string) => {
      expect(query).toBe("cloud hosting");
      return [{ title: "Nimbus Cloud compared", url: "https://news.ycombinator.com/item?id=9", community: "Hacker News", score: 4, comments: 2, createdAt: "2026-10-13T00:00:00.000Z" }];
    }) };
    const options = { sources: [source], database, now: () => Date.parse("2026-10-14T00:00:00.000Z") };
    await refreshDiscovery("own", options); await refreshDiscovery("own", options);
    const rows = listDiscoveryItems("own", undefined, database);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "old", title: "Nimbus Cloud compared", status: "saved", promptId: "p" });
    expect(rows[0]!.relevance).toBeGreaterThan(0);
    expect(source.search).toHaveBeenCalledTimes(2);
  });

  it("caps each refresh at ten active prompts and continues after a source failure", async () => {
    database = new Database(":memory:"); migrateDatabase(database);
    database.prepare("INSERT INTO brands(id,user_id,name) VALUES ('own','u','Acme')").run();
    const insert = database.prepare("INSERT INTO prompts(id,brand_id,text,status) VALUES (@id,'own',@text,'active')");
    for (let i = 0; i < 12; i++) insert.run({ id: `p${i}`, text: `cloud hosting provider ${i}` });
    const result = await refreshDiscovery("own", { database, sources: [{ id: "hn", search: async () => { throw new Error("offline"); } }] });
    expect(result).toMatchObject({ promptsSearched: 10, itemsFound: 0, sourceFailures: 10 });
  });
});
