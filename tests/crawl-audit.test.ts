import { describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrateDatabase } from "@/db/migrate";
import { brands, schema } from "@/db/schema";
import { auditAndSave, getCrawlAuditHistory } from "@/lib/crawl-audit";
import { auditUrl, isBlockedFor } from "@/lib/crawl-audit";

describe("crawl audit analysis", () => {
  it("evaluates crawler-specific robots groups and more specific allow rules", () => {
    const robots = `User-agent: *\nDisallow: /private\n\nUser-agent: GPTBot\nDisallow: /\nAllow: /public`;
    expect(isBlockedFor(robots, "GPTBot", "/private/page")).toBe(true);
    expect(isBlockedFor(robots, "GPTBot", "/public/page")).toBe(false);
    expect(isBlockedFor(robots, "ClaudeBot", "/private/page")).toBe(true);
    expect(isBlockedFor("User-agent: GPTBot\nDisallow: /", "Google-Extended")).toBe(false);
  });

  it("reports fixes for each failed check and rejects an empty JavaScript shell as usable content", async () => {
    const fetcher = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: GPTBot\nDisallow: /");
      return new Response(url.endsWith("/sitemap.xml") || url.endsWith("/llms.txt") ? "ok" : '<div id="root"></div><script>document.write("rendered")</script>', { status: 200 });
    });
    const result = await auditUrl("https://public.example/", fetcher);
    expect(result.score).toBe(40);
    expect(result.checks.find((check) => check.id === "content")).toMatchObject({ ok: false, detail: "0 words outside scripts and styles" });
    expect(result.checks.filter((check) => !check.ok).every((check) => check.fix.length > 0)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("checks structured data and the main page without making unauthenticated global state", async () => {
    const longReadableCopy = Array.from({ length: 155 }, () => "Helpful pages explain useful details for people.").join(" ");
    const html = `<title>Helpful</title><meta name="description" content="Page details"><link rel="canonical" href="https://public.example/"><h1>Helpful</h1><h2>First</h2><h2>Second</h2><script type="application/ld+json">{"@type":"Organization"}</script><p>${longReadableCopy}</p>`;
    const fetcher = async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /");
      if (url.endsWith("sitemap.xml") || url.endsWith("llms.txt")) return new Response("ok");
      return new Response(html, { status: 200, headers: { "x-robots-tag": "index, follow" } });
    };
    const result = await auditUrl("https://public.example/", fetcher);
    expect(result.checks.find((check) => check.id === "content")?.ok).toBe(true);
    expect(result.checks.find((check) => check.id === "metadata")?.ok).toBe(true);
    expect(result.checks.find((check) => check.id === "jsonld")?.detail).toContain("Organization");
  });

  it("persists repeat audits with a score delta and bounded history", async () => {
    const db = new Database(":memory:");
    try {
      migrateDatabase(db);
      const drizzleDb = drizzle(db, { schema });
      drizzleDb.insert(brands).values({ id: "own", userId: "user-a", name: "Own" }).run();
      const fetcher = async (input: string | URL) => {
        const url = String(input);
        if (url.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /");
        if (url.endsWith("sitemap.xml") || url.endsWith("llms.txt")) return new Response("ok");
        return new Response("<main>Useful text</main>");
      };
      const first = await auditAndSave("own", "https://echorank-public.com/", fetcher, db);
      const second = await auditAndSave("own", "https://echorank-public.com/", fetcher, db);
      expect(first.previousScore).toBeNull();
      expect(second.previousScore).toBe(first.score);
      expect(second.delta).toBe(second.score - first.score);
      expect(getCrawlAuditHistory("own", drizzleDb)).toHaveLength(2);
      expect(db.prepare("SELECT COUNT(*) AS count FROM crawl_audits WHERE brand_id = @brandId").get({ brandId: "own" })).toEqual({ count: 2 });
    } finally { db.close(); }
  });
});
