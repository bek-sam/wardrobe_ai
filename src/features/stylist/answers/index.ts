import { z } from "zod";
import { AVAILABILITY_STATUSES } from "@/features/wardrobe";
import { OUTFIT_ITEM_ROLES } from "@/features/outfits";
export const INSIGHT_FOCUSES = [
  "overview",
  "most_worn",
  "least_worn",
  "never_worn",
  "cost_per_wear",
  "gaps",
] as const;

/**
 * Shapes the stylist UI renders for non-outfit answers. Parsing with these
 * strips anything the orchestrator did not intend to expose (raw rows,
 * coordinates, scores it did not mean to publish) and clamps every string and
 * list, exactly like the outfit sanitizer does.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const uuid = z.string().uuid();

const label = z.string().trim().min(1).max(160);

const note = z.string().trim().min(1).max(400);

const answerText = z.string().trim().min(1).max(1_200);

const generationId = uuid.nullable();

const planDayWeatherSchema = z
  .object({
    locationName: z.string().max(160).nullable(),
    minimumTemperatureC: z.number().nullable(),
    maximumTemperatureC: z.number().nullable(),
    precipitationProbability: z.number().nullable(),
    tags: z.array(z.string().min(1).max(80)).max(12),
  })
  .nullable();

const planDayItemSchema = z.object({
  item_id: uuid,
  role: z.enum(OUTFIT_ITEM_ROLES),
  sort_order: z.number().int().min(0).max(50),
  name: label,
  category: label,
});

const planDayViewSchema = z.object({
  date: isoDate,
  title: label,
  explanation: note,
  confidence: z.number().min(0).max(1),
  occasion: z.string().max(120).nullable(),
  items: z.array(planDayItemSchema).min(1).max(8),
  weather: planDayWeatherSchema,
});

const planWindow = {
  generationId,
  answer: answerText,
  startDate: isoDate,
  endDate: isoDate,
  dayCount: z.number().int().min(1).max(14),
  days: z.array(planDayViewSchema).max(14),
  missingCategories: z.array(label).max(12),
};

export const planAnswerSchema = z.object({
  ...planWindow,
  kind: z.literal("plan"),
  intent: z.literal("planning"),
  /**
   * Whether this plan has been written to outfit_plans. A new answer is always
   * false -- chat never auto-saves -- and save_recorded_generated_week flips
   * the stored message to true, so a reloaded conversation is accurate.
   * Anything non-boolean sanitizes away rather than being trusted.
   */
  saved: z.boolean(),
});

export const packingAnswerSchema = z.object({
  ...planWindow,
  kind: z.literal("packing"),
  intent: z.literal("packing"),
  destination: z.string().max(80).nullable(),
  packingList: z
    .array(
      z.object({
        itemId: uuid,
        name: label,
        role: z.enum(OUTFIT_ITEM_ROLES),
        category: label,
        dayCount: z.number().int().min(1).max(14),
      }),
    )
    .max(48),
  essentials: z.array(note).max(12),
});

export const insightAnswerSchema = z.object({
  kind: z.literal("insight"),
  intent: z.literal("insight"),
  generationId,
  answer: answerText,
  focus: z.enum(INSIGHT_FOCUSES),
  since: isoDate.nullable(),
  highlights: z
    .array(
      z.object({
        label: label,
        detail: note.nullable(),
        itemId: uuid.nullable(),
      }),
    )
    .max(12),
  stats: z.object({
    itemCount: z.number().int().nonnegative(),
    neverWornCount: z.number().int().nonnegative(),
    unwornCount: z.number().int().nonnegative(),
    possibleFoundations: z.number().int().nonnegative(),
  }),
});

export const itemQuestionAnswerSchema = z.object({
  kind: z.literal("item_question"),
  intent: z.literal("item_question"),
  generationId,
  answer: answerText,
  query: z.string().trim().min(1).max(200),
  matchCount: z.number().int().nonnegative(),
  matches: z
    .array(
      z.object({
        itemId: uuid,
        name: label,
        brand: z.string().max(120).nullable(),
        category: label,
        subcategory: z.string().max(80).nullable(),
        colorNames: z.array(z.string().min(1).max(80)).max(12),
        availability: z.enum(AVAILABILITY_STATUSES),
        favorite: z.boolean(),
        wearCount: z.number().int().nonnegative(),
        lastWornAt: z.string().max(40).nullable(),
        score: z.number(),
      }),
    )
    .max(24),
});

export const nonOutfitAnswerSchema = z.discriminatedUnion("kind", [
  planAnswerSchema,
  packingAnswerSchema,
  insightAnswerSchema,
  itemQuestionAnswerSchema,
]);

export type SanitizedNonOutfitAnswer = z.infer<typeof nonOutfitAnswerSchema>;

/**
 * Reduces a stored plan/packing/insight/item answer to the fields the product
 * UI renders. Returns null for anything that does not parse, so a malformed
 * or legacy row is simply not shown rather than partially trusted.
 */
export function sanitizeNonOutfitAnswer(value: unknown): SanitizedNonOutfitAnswer | null {
  const parsed = nonOutfitAnswerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
