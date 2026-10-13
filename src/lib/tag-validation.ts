import { z } from "zod";

export const tagCreateSchema = z.object({ name: z.string().trim().min(1).max(40) }).strict();
export const tagLinkSchema = z.object({ tagId: z.string().uuid() }).strict();
