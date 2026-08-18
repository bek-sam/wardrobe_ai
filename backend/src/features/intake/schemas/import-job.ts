import { z } from "zod";

export const createImportJobSchema = z
  .object({
    originalImagePath: z.string().min(3).max(1_000),
    userHint: z.string().trim().max(500).nullable().optional(),
    idempotencyKey: z.string().min(8).max(200).optional(),
  })
  .strict();

export const candidateMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(80),
    subcategory: z.string().trim().min(1).max(80).nullable(),
    primary_color_hex: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable(),
    secondary_color_hex: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable(),
    color_names: z.array(z.string().trim().min(1).max(40)).max(8),
    pattern: z.string().trim().min(1).max(80).nullable(),
    silhouette: z.string().trim().min(1).max(80).nullable(),
    materials: z.record(z.string(), z.unknown()),
    visible_text: z.array(z.string().trim().min(1).max(120)).max(12),
    season_tags: z.array(z.string().trim().min(1).max(40)).max(8),
    occasion_tags: z.array(z.string().trim().min(1).max(60)).max(12),
    notes: z.string().trim().max(2_000),
  })
  .strict();

export const updateImportCandidateSchema = z
  .object({
    metadata: candidateMetadataSchema.partial().optional(),
    boundingBox: z
      .object({
        x: z.number().int().min(0).max(999),
        y: z.number().int().min(0).max(999),
        width: z.number().int().min(1).max(1000),
        height: z.number().int().min(1).max(1000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => value.metadata || value.boundingBox, "Provide metadata or a bounding box.");

export const regenerateCutoutSchema = z
  .object({
    instruction: z.string().trim().max(1_200).nullable().optional(),
    cleanupTolerance: z.number().int().min(18).max(110).optional(),
  })
  .strict();
