import { z } from "zod";

export const crawlAuditSchema = z.object({
  url: z.string().trim().min(1).max(2048).url().refine((value) => {
    try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:"; } catch { return false; }
  }, "Enter a valid HTTP or HTTPS URL."),
}).strict();
