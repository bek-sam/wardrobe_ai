import { z } from "zod";

export const limitResultSchema = z
  .object({
    allowed: z.boolean(),
    limit: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    reset_at: z.string().nullable().optional(),
  })
  .passthrough();
