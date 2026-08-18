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

/**
 * Saving a chat plan takes the generation id and nothing else: the plan days
 * themselves are replayed from the server-recorded agent run, never accepted
 * from the browser.
 */
export const saveGeneratedPlanRequestSchema = z
  .object({ generationId: z.string().uuid() })
  .strict();

/** Strict shape of what save_recorded_generated_week is allowed to return. */
export const savedGeneratedPlanSchema = z
  .array(z.object({ plan_id: z.string().uuid(), outfit_id: z.string().uuid() }).strict())
  .min(1)
  .max(7);
