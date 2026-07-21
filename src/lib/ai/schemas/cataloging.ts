import { z } from "zod";

const confidence = z.number().min(0).max(1);

export const detectedGarmentSchema = z
  .object({
    suggestedName: z.string().min(1).max(160),
    category: z.enum([
      "tops",
      "bottoms",
      "dresses",
      "outerwear",
      "shoes",
      "accessories",
      "bags",
      "activewear",
      "swimwear",
      "underwear",
      "other",
    ]),
    subcategory: z.string().max(80).nullable(),
    boundingBox: z
      .object({
        x: z.number().int().min(0).max(999),
        y: z.number().int().min(0).max(999),
        width: z.number().int().min(1).max(1000),
        height: z.number().int().min(1).max(1000),
      })
      .strict(),
    primaryColorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
    secondaryColorHex: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable(),
    colorNames: z.array(z.string().min(1).max(40)).max(8),
    pattern: z.string().max(80).nullable(),
    silhouette: z.string().max(80).nullable(),
    apparentMaterial: z.string().max(120).nullable(),
    materialIsInferred: z.literal(true),
    visibleText: z.array(z.string().min(1).max(120)).max(12),
    visibleLogoDescription: z.string().max(200).nullable(),
    seasonSuggestions: z.array(z.string().min(1).max(40)).max(6),
    occasionSuggestions: z.array(z.string().min(1).max(60)).max(8),
    fieldConfidence: z
      .object({
        category: confidence,
        colors: confidence,
        pattern: confidence,
        silhouette: confidence,
        material: confidence,
        visibleText: confidence,
        boundingBox: confidence,
      })
      .strict(),
  })
  .strict();

export const catalogingResultSchema = z
  .object({
    garments: z.array(detectedGarmentSchema).max(12),
    imageNotes: z.string().max(500),
  })
  .strict();

export type DetectedGarment = z.infer<typeof detectedGarmentSchema>;
export type CatalogingResult = z.infer<typeof catalogingResultSchema>;
