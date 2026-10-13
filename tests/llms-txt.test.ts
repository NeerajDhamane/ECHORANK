import { describe, expect, it } from "vitest";
import { isBlockedFor } from "@/lib/crawl-audit";
import { buildLlmsTxt, buildRobots, GENERATED_BOTS, siteSitemapUrl } from "@/lib/llms-txt";

describe("llms.txt and robots.txt builders", () => {
  it("builds llms.txt from entered information and ignores invalid page URLs", () => {
    const output = buildLlmsTxt({
      name: "Acme\nUser-agent: *",
      summary: "Helpful pages\nwith clear details",
      pages: [
        { title: "Pricing", url: "https://acme.example/pricing", note: "Plans and features" },
        { title: "Unsafe", url: "javascript:alert(1)", note: "skip" },
      ],
      contactUrl: "https://acme.example/about",
    });
    expect(output).toContain("# Acme User-agent: *");
    expect(output).toContain("> Helpful pages with clear details");
    expect(output).toContain("- [Pricing](https://acme.example/pricing): Plans and features");
    expect(output).not.toContain("Unsafe");
    expect(output).toContain("## About and contact\n- https://acme.example/about");
  });

  it("emits an exact Disallow group for a blocked bot and parser-compatible rules for all offered agents", () => {
    const allow = Object.fromEntries(GENERATED_BOTS.map((bot) => [bot, bot !== "GPTBot"]));
    const output = buildRobots("https://acme.example/sitemap.xml", allow);
    expect(output.match(/User-agent: GPTBot\nDisallow: \/\n/gu)).toHaveLength(1);
    expect(isBlockedFor(output, "GPTBot")).toBe(true);
    expect(isBlockedFor(output, "ClaudeBot")).toBe(false);
    expect(isBlockedFor(output, "Applebot-Extended")).toBe(false);
    expect(output).toContain("Sitemap: https://acme.example/sitemap.xml");
    expect(() => buildRobots("file:///robots", allow)).toThrow(/HTTP or HTTPS/u);
  });

  it("builds the sitemap URL from the site origin", () => {
    expect(siteSitemapUrl("https://acme.example/path/page")).toBe("https://acme.example/sitemap.xml");
    expect(siteSitemapUrl("javascript:alert(1)")).toBeNull();
  });
});
