import { z } from "zod";

export const researchRequestSchema = z
  .object({
    userClue: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const acceptResearchSchema = z
  .object({
    fields: z
      .array(
        z.enum([
          "name",
          "brand",
          "product_name",
          "model_number",
          "barcode",
          "category",
          "subcategory",
          "materials",
          "season_tags",
          "water_resistance",
          "care_instructions",
        ]),
      )
      .min(1)
      .max(11),
  })
  .strict();
