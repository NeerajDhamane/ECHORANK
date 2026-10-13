import { z } from "zod";

export const contentScoreSchema = z.object({
  label: z.string().trim().max(80).optional(),
  content: z.string().trim().min(1).max(100_000),
}).strict();
