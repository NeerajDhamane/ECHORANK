import { z } from "zod";
import type { Scope } from "@/lib/analytics";

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/).refine((value) => {
  const timestamp = value.includes("T") ? value : `${value}T00:00:00.000Z`;
  return !Number.isNaN(Date.parse(timestamp)) && new Date(timestamp).toISOString().slice(0, value.length) === value;
}, "Expected a real UTC date.");

export const overviewQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "custom"]).optional().default("30d"),
  from: dateValue.optional(),
  to: dateValue.optional(),
  platform: z.string().trim().min(1).max(100).optional(),
  promptId: z.string().trim().min(1).max(100).optional(),
  tagId: z.string().trim().min(1).max(100).optional(),
  locale: z.string().trim().min(1).max(35).optional(),
  includeSimulated: z.enum(["true", "false"]).optional().default("false"),
}).strict().superRefine((value, context) => {
  if (value.range === "custom" && (!value.from || !value.to)) {
    context.addIssue({ code: "custom", message: "Custom ranges need both from and to dates." });
  }
  if (value.range === "custom" && value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", message: "The from date must be before the to date." });
  }
});

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

export function overviewScope(brandId: string, query: OverviewQuery, now = new Date()): Scope {
  const today = now.toISOString().slice(0, 10);
  const days = query.range === "7d" ? 7 : query.range === "90d" ? 90 : 30;
  const start = new Date(`${today}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {
    brandId,
    dateFrom: query.range === "custom" ? query.from : start.toISOString().slice(0, 10),
    dateTo: query.range === "custom" ? query.to : today,
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.promptId ? { promptId: query.promptId } : {}),
    ...(query.tagId ? { tagId: query.tagId } : {}),
    ...(query.locale ? { locale: query.locale } : {}),
    includeSimulated: query.includeSimulated === "true",
  };
}
