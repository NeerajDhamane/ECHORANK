export const GENERATED_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended"] as const;
export type GeneratedBot = typeof GENERATED_BOTS[number];
export type LlmsPage = { title: string; url: string; note: string };

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function safePageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

/** Build an llms.txt draft; the convention does not imply crawler adoption or citations. */
export function buildLlmsTxt(input: { name: string; summary: string; pages: LlmsPage[]; contactUrl?: string }) {
  const lines = [`# ${singleLine(input.name) || "Site name"}`, "", `> ${singleLine(input.summary) || "Site description"}`, "", "## Key pages"];
  const pages = input.pages.flatMap((page) => {
    const title = singleLine(page.title);
    const url = safePageUrl(page.url);
    const note = singleLine(page.note);
    return title && url ? [`- [${title}](${url})${note ? `: ${note}` : ""}`] : [];
  });
  lines.push(...(pages.length ? pages : ["(Add key pages above.)"]));
  const contactUrl = input.contactUrl ? safePageUrl(input.contactUrl) : null;
  if (contactUrl) lines.push("", "## About and contact", `- ${contactUrl}`);
  return `${lines.join("\n")}\n`;
}

/** Build individual crawler groups; the wildcard group leaves other agents unchanged. */
export function buildRobots(sitemapUrl: string, allow: Partial<Record<GeneratedBot, boolean>>) {
  const sitemap = safePageUrl(sitemapUrl);
  if (!sitemap) throw new Error("Enter a valid HTTP or HTTPS sitemap URL.");
  const groups = GENERATED_BOTS.map((bot) => `User-agent: ${bot}\n${allow[bot] === false ? "Disallow: /" : "Allow: /"}`);
  return `${groups.join("\n\n")}\n\nUser-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
}

export function siteSitemapUrl(siteUrl: string): string | null {
  const safe = safePageUrl(siteUrl);
  if (!safe) return null;
  const parsed = new URL(safe);
  return new URL("/sitemap.xml", parsed.origin).toString();
}
