import { z } from "zod";

export const importJobParamsSchema = z.object({ jobId: z.string().uuid() }).strict();

export const confirmationResultSchema = z
  .object({
    job_id: z.string().uuid(),
    item_ids: z.array(z.string().uuid()).min(1),
    already_confirmed: z.boolean(),
  })
  .strict()
  .refine((value) => new Set(value.item_ids).size === value.item_ids.length, {
    message: "Confirmed item IDs must be unique.",
  });
