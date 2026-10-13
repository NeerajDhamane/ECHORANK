import { z } from "zod";

const password = z.string().min(8).max(128).refine(
  (value) => new TextEncoder().encode(value).length <= 72,
  "Password must be at most 72 UTF-8 bytes.",
);

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password,
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128).refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password is too long.",
  ),
});
