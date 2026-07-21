import { z } from "zod";

export const stylistRequestSchema = z
  .object({
    message: z.string().trim().min(2).max(2_000),
    conversationId: z.string().uuid().nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().trim().min(2).max(160).nullable().optional(),
    occasion: z.string().trim().min(1).max(120).nullable().optional(),
    targetFormality: z.number().int().min(1).max(5).optional(),
    indoorOutdoor: z.enum(["indoor", "outdoor", "mixed"]).nullable().optional(),
  })
  .strict();

export const generateOutfitRequestSchema = stylistRequestSchema
  .omit({ conversationId: true })
  .extend({ save: z.boolean().default(false) });

export const saveGeneratedOutfitRequestSchema = z
  .object({ generationId: z.string().uuid() })
  .strict();

export const stylistConversationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(25).default(12),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const stylistMessageListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(100),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const stylistConversationParamsSchema = z
  .object({ conversationId: z.string().uuid() })
  .strict();
