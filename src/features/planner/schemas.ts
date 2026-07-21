import { z } from "zod";

export const generatePlanSchema = z
  .object({
    days: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            occasion: z.string().trim().min(1).max(120).nullable().optional(),
            location: z.string().trim().min(2).max(160).nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(7),
    save: z.boolean().default(false),
  })
  .strict()
  .refine((value) => new Set(value.days.map((day) => day.date)).size === value.days.length, {
    message: "Each planned date must be unique.",
  });
