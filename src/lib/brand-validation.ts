import { z } from "zod";

const nameSchema = z.string().trim().min(1).max(100);
const aliasesSchema = z.array(z.string().trim().min(1).max(100)).max(30).default([]).refine(
  (aliases) => new Set(aliases.map((alias) => alias.toLocaleLowerCase())).size === aliases.length,
  "Aliases must be unique.",
);
const websiteSchema = z.union([
  z.string().trim().max(2048).url().refine((value) => /^https?:\/\//i.test(value), "Website must use http or https."),
  z.literal(""), z.null(),
]).optional().transform((value) => value === "" ? null : value);
const industrySchema = z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional().transform((value) => value === "" ? null : value);

export const brandCreateSchema = z.object({
  name: nameSchema,
  aliases: aliasesSchema,
  website: websiteSchema,
  industry: industrySchema,
}).strict();

export const brandPatchSchema = z.object({
  name: nameSchema.optional(),
  aliases: aliasesSchema.optional(),
  website: websiteSchema,
  industry: industrySchema,
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const competitorDeleteSchema = z.object({ competitorId: z.string().uuid() }).strict();
