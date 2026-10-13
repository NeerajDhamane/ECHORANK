import { z } from "zod";

const topicId = z.string().uuid().nullable();
const promptStatus = z.enum(["active", "suggested", "inactive"]);

export const promptCreateSchema = z.object({
  text: z.string().trim().min(3).max(500),
  topicId: topicId.optional().default(null),
  status: promptStatus.optional().default("active"),
  locale: z.string().trim().min(2).max(35).optional().default("global"),
}).strict();

export const promptPatchSchema = z.object({
  text: z.string().trim().min(3).max(500).optional(),
  topicId: topicId.optional(),
  status: promptStatus.optional(),
  locale: z.string().trim().min(2).max(35).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const topicCreateSchema = z.object({ name: z.string().trim().min(1).max(60) }).strict();
export const promptListQuerySchema = z.object({
  status: promptStatus.optional(),
  suggest: z.literal("1").optional(),
}).strict();
