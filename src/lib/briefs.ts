import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { getSqlite } from "@/db";
import type { BrandRecord } from "@/lib/brand-access";
import { getProviders } from "@/lib/providers/registry";

export type BriefContext = { promptId: string; prompt: string; rivals: string[]; snippets: string[]; domains: string[] };

export function buildBrief(context: BriefContext, brand: Pick<BrandRecord, "name" | "industry" | "website">): string {
  const rivalText = context.rivals.length ? context.rivals.join(", ") : "[FILL IN: relevant competitors]";
  const snippetSections = context.snippets.length ? context.snippets.map((snippet) => `- ${snippet}`).join("\n") : "- No rival descriptions are available in the tracked answers yet.";
  const domains = context.domains.length ? context.domains.map((domain) => `- ${domain}`).join("\n") : "- No cited domains are recorded for this prompt yet.";
  const industry = brand.industry || "[FILL IN: industry]";
  return `# Brief: ${context.prompt}\n\n**Goal:** Be a clear, useful answer when someone asks “${context.prompt}”.\n\n## Title suggestion\n${industry}: a practical answer to “${context.prompt}” — ${brand.name} and ${rivalText}\n\n## Direct answer (write this first)\n[FILL IN: Write a 40–60 word answer based on verified product facts. No verified product facts were supplied.]\n\n## Outline\n### What the question means\nAnswer the buyer's question directly and define any important terms.\n\n### Options seen in tracked answers\nDescribe only what the evidence supports; separate verified facts from opinion.\n\n### How to compare options\nUse the criteria below and explain how readers can verify each one.\n\n## Evidence from tracked answers\nRivals appearing for this prompt: ${rivalText}.\n\n${snippetSections}\n\n## Comparison criteria\n- [FILL IN: criteria supported by verified product documentation]\n- Include ${brand.name} only where its details have been verified.\n\n## FAQs\n1. What should I consider when choosing an option for this need? — [FILL IN: answer from verified sources]\n2. How do the available options differ? — [FILL IN: compare verified facts only]\n3. What information should I confirm before deciding? — [FILL IN: list practical checks]\n4. Where can I find current product details? — [FILL IN: link to verified documentation]\n\n## Third-party sources cited in this prompt\n${domains}\n\n## Structured data to consider\nFAQPage (only for visible questions and answers) and Organization, with verified fields only.\n\n## Style rules\nUse plain prose and short sentences. Put the direct answer first. Avoid number-dense paragraphs. Do not make unsupported claims about ${brand.name}. Mark every unknown as [FILL IN].\n`;
}

export function getBriefContext(brandId: string, promptId: string, database: Database.Database = getSqlite()): BriefContext | null {
  const prompt = database.prepare("SELECT id AS promptId, text AS prompt FROM prompts WHERE id = @promptId AND brand_id = @brandId AND status = 'active' AND deleted_at IS NULL").get({ brandId, promptId }) as Pick<BriefContext, "promptId" | "prompt"> | undefined;
  if (!prompt) return null;
  const rivals = database.prepare("SELECT id, name FROM brands WHERE owner_brand_id = @brandId AND deleted_at IS NULL ORDER BY name").all({ brandId }) as Array<{ id: string; name: string }>;
  const names = new Map(rivals.map(({ id, name }) => [id, name]));
  const answers = database.prepare("SELECT c.raw_response AS rawResponse, c.brands_found AS brandsFound FROM chats c WHERE c.brand_id = @brandId AND c.prompt_id = @promptId AND c.error IS NULL ORDER BY c.created_at DESC LIMIT 200").all({ brandId, promptId }) as Array<{ rawResponse: string | null; brandsFound: string | null }>;
  const snippets: string[] = [];
  const rivalCounts = new Map<string, number>();
  for (const answer of answers) {
    let found: unknown;
    try { found = JSON.parse(answer.brandsFound ?? "[]") as unknown; } catch { found = []; }
    if (Array.isArray(found)) for (const item of found) {
      if (typeof item !== "object" || item === null || !("brandId" in item) || typeof item.brandId !== "string") continue;
      const name = names.get(item.brandId);
      if (!name) continue;
      rivalCounts.set(name, (rivalCounts.get(name) ?? 0) + 1);
      if (typeof answer.rawResponse === "string" && snippets.length < 8) {
        const excerpt = answer.rawResponse.split(/(?<=[.!?])\s+/).find((sentence) => sentence.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
        if (excerpt && !snippets.includes(excerpt.slice(0, 400))) snippets.push(excerpt.slice(0, 400));
      }
    }
  }
  const domains = database.prepare("SELECT DISTINCT s.domain FROM chat_sources cs JOIN sources s ON s.id = cs.source_id JOIN chats c ON c.id = cs.chat_id WHERE c.brand_id = @brandId AND c.prompt_id = @promptId ORDER BY s.domain LIMIT 12").all({ brandId, promptId }) as Array<{ domain: string }>;
  return { ...prompt, rivals: [...rivalCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([name]) => name), snippets, domains: domains.map(({ domain }) => domain) };
}

export async function generateAndSaveBrief(brand: Pick<BrandRecord, "id" | "name" | "industry" | "website">, context: BriefContext, database: Database.Database = getSqlite()) {
  let brief = buildBrief(context, brand);
  let enriched = false;
  const provider = getProviders().find((candidate) => !candidate.isMock);
  if (provider) {
    const prompt = `You are a content strategist. Using ONLY the facts below, enrich this content brief for: ${JSON.stringify(context.prompt)}. Brand: ${JSON.stringify(brand.name)} (${JSON.stringify(brand.website)}; industry ${JSON.stringify(brand.industry)}). Rivals seen: ${JSON.stringify(context.rivals)}. Rival snippets: ${JSON.stringify(context.snippets)}. Cited sites: ${JSON.stringify(context.domains)}. Keep all sections, provide four FAQs, and do not invent facts or statistics about the brand; mark every unknown as [FILL IN]. Preserve the supplied evidence accurately.\n\nBase brief:\n${brief}`;
    try { brief = await provider.run(prompt); enriched = true; } catch { /* deterministic brief remains available when a provider fails */ }
  }
  const id = randomUUID();
  database.prepare("INSERT INTO content_briefs (id, brand_id, prompt_id, brief) VALUES (@id, @brandId, @promptId, @brief)").run({ id, brandId: brand.id, promptId: context.promptId, brief });
  return { id, promptId: context.promptId, brief, enriched };
}
