import { z } from "zod";

import { outfitItemSelectionSchema } from "@/features/outfits/schemas";
import { AVAILABILITY_STATUSES, WARDROBE_ITEM_STATUSES } from "@/features/wardrobe/types";

const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const nullableText = (maximum: number) => text(maximum).nullable();
const textList = z.array(text(80)).max(50);
const jsonObject = z.record(z.string(), z.unknown());
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Expected a real calendar date.");
const isoTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/, "Expected an ISO time.");
const timestamp = z.string().datetime({ offset: true });
const optionalBooleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
};

export const itemParamsSchema = z.object({ itemId: z.string().uuid() }).strict();
export const outfitParamsSchema = z.object({ outfitId: z.string().uuid() }).strict();
export const planParamsSchema = z.object({ planId: z.string().uuid() }).strict();

export const profileUpdateSchema = z
  .object({
    first_name: nullableText(100).optional(),
    display_name: nullableText(160).optional(),
    avatar_path: nullableText(500).optional(),
    home_location_name: nullableText(200).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    timezone: text(100).optional(),
    temperature_unit: z.enum(["celsius", "fahrenheit"]).optional(),
    locale: text(35).optional(),
    onboarding_completed_at: timestamp.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required.");

export const styleProfileUpdateSchema = z
  .object({
    style_keywords: textList.optional(),
    favorite_colors: textList.optional(),
    avoided_colors: textList.optional(),
    preferred_fits: textList.optional(),
    preferred_formality: z.number().int().min(1).max(5).nullable().optional(),
    runs_cold: z.boolean().nullable().optional(),
    runs_hot: z.boolean().nullable().optional(),
    modesty_preferences: jsonObject.optional(),
    size_profile: jsonObject.optional(),
    common_activities: textList.optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one style field is required.")
  .refine(
    (value) => !(value.runs_cold === true && value.runs_hot === true),
    "runs_cold and runs_hot cannot both be true.",
  );

export const itemListQuerySchema = z
  .object({
    search: text(120).optional(),
    category: text(80).optional(),
    brand: text(120).optional(),
    color: text(80).optional(),
    season: text(80).optional(),
    occasion: text(80).optional(),
    formality: z.coerce.number().int().min(1).max(5).optional(),
    status: z.enum(WARDROBE_ITEM_STATUSES).optional(),
    availability: z.enum(AVAILABILITY_STATUSES).optional(),
    favorite: optionalBooleanQuery,
    ...pagination,
  })
  .strict();

export const favoriteSchema = z.object({ favorite: z.boolean() }).strict();
export const availabilitySchema = z
  .object({ availability_status: z.enum(AVAILABILITY_STATUSES) })
  .strict();

export const markItemWornSchema = z
  .object({
    worn_at: timestamp.optional(),
    notes: nullableText(2_000).optional(),
    idempotency_key: text(200).optional(),
  })
  .strict();

const outfitMetadataShape = {
  name: text(160),
  occasion: nullableText(160).default(null),
  season_tags: textList.default([]),
  weather_context: jsonObject.nullable().default(null),
  explanation: nullableText(1_500).default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  favorite: z.boolean().default(false),
};

export const outfitCreateSchema = z
  .object({
    ...outfitMetadataShape,
    items: z.array(outfitItemSelectionSchema).min(1).max(5),
  })
  .strict()
  .superRefine((outfit, context) => {
    const itemIds = new Set<string>();
    const roles = new Set<string>();
    outfit.items.forEach((item, index) => {
      if (itemIds.has(item.item_id)) {
        context.addIssue({
          code: "custom",
          message: "Outfit items must be unique.",
          path: ["items", index],
        });
      }
      if (roles.has(item.role)) {
        context.addIssue({
          code: "custom",
          message: `Only one ${item.role} is allowed.`,
          path: ["items", index],
        });
      }
      itemIds.add(item.item_id);
      roles.add(item.role);
    });
    const hasDress = roles.has("dress");
    const hasTop = roles.has("top");
    const hasBottom = roles.has("bottom");
    if (hasDress ? hasTop || hasBottom : !hasTop || !hasBottom) {
      context.addIssue({
        code: "custom",
        message: "A complete outfit requires one dress or one top with one bottom.",
        path: ["items"],
      });
    }
  });

export const outfitUpdateSchema = z
  .object({
    name: text(160).optional(),
    occasion: nullableText(160).optional(),
    season_tags: textList.optional(),
    weather_context: jsonObject.nullable().optional(),
    explanation: nullableText(1_500).optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    favorite: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one outfit field is required.");

export const outfitListQuerySchema = z
  .object({
    source: z.enum(["user", "ai"]).optional(),
    favorite: optionalBooleanQuery,
    worn: z
      .literal("true")
      .transform(() => true)
      .optional(),
    ...pagination,
  })
  .strict();

export const feedbackSchema = z
  .object({
    feedback_type: z.enum([
      "like",
      "dislike",
      "too_warm",
      "too_cold",
      "too_formal",
      "too_casual",
      "color",
      "fit",
      "repetition",
      "other",
    ]),
    comment: nullableText(1_000).optional(),
  })
  .strict();

export const markOutfitWornSchema = z
  .object({
    worn_at: timestamp.optional(),
    outfit_plan_id: z.string().uuid().nullable().optional(),
    comfort_rating: z.number().int().min(1).max(5).nullable().optional(),
    style_rating: z.number().int().min(1).max(5).nullable().optional(),
    weather_rating: z.number().int().min(1).max(5).nullable().optional(),
    notes: nullableText(2_000).optional(),
    idempotency_key: text(200).optional(),
  })
  .strict();

export const swapOutfitItemSchema = z
  .object({
    remove_item_id: z.string().uuid(),
    replacement_item_id: z.string().uuid(),
  })
  .strict()
  .refine(
    (value) => value.remove_item_id !== value.replacement_item_id,
    "Replacement must be a different item.",
  );

const planShape = {
  outfit_id: z.string().uuid().nullable().default(null),
  planned_date: isoDate,
  start_time: isoTime.nullable().default(null),
  occasion: nullableText(160).default(null),
  location_name: nullableText(200).default(null),
  event_title: nullableText(200).default(null),
  weather_snapshot: jsonObject.nullable().default(null),
  status: z.literal("planned").default("planned"),
};

export const planCreateSchema = z.object(planShape).strict();
export const planUpdateSchema = z
  .object({
    outfit_id: z.string().uuid().nullable().optional(),
    planned_date: isoDate.optional(),
    start_time: isoTime.nullable().optional(),
    occasion: nullableText(160).optional(),
    location_name: nullableText(200).optional(),
    event_title: nullableText(200).optional(),
    weather_snapshot: jsonObject.nullable().optional(),
    status: z.enum(["planned", "skipped"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one plan field is required.");

export const planListQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    status: z.enum(["planned", "worn", "skipped"]).optional(),
    ...pagination,
  })
  .strict()
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "from must not be after to.",
  );

export const accountDeletionSchema = z.object({ confirmation: z.string().uuid() }).strict();

export const accountDeletionManifestSchema = z
  .object({
    user_id: z.string().uuid(),
    wardrobe_item_count: z.number().nonnegative(),
    outfit_count: z.number().nonnegative(),
    conversation_count: z.number().nonnegative(),
    storage_objects: z.array(
      z.object({
        bucket_id: z.enum([
          "wardrobe-originals",
          "wardrobe-items",
          "wardrobe-labels",
          "wardrobe-generated",
          "profile-references",
        ]),
        name: text(1_024),
      }),
    ),
  })
  .strict();
