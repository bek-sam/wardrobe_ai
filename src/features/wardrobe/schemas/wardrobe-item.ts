import { z } from "zod";

import {
  AVAILABILITY_STATUSES,
  WARDROBE_ITEM_ROLES,
  WARDROBE_ITEM_SOURCES,
  WARDROBE_ITEM_STATUSES,
  WATER_RESISTANCE_LEVELS,
} from "../types";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;

const nullableText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();
const stringList = z.array(z.string().trim().min(1).max(80)).max(50);
const level = z.number().int().min(1).max(5);
const timestamp = z.string().datetime({ offset: true });

export const wardrobeItemSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    status: z.enum(WARDROBE_ITEM_STATUSES).default("active"),
    source: z.enum(WARDROBE_ITEM_SOURCES).default("manual"),

    name: z.string().trim().min(1).max(160),
    brand: nullableText(120).default(null),
    product_name: nullableText(160).default(null),
    model_number: nullableText(100).default(null),
    barcode: nullableText(100).default(null),
    category: z.string().trim().min(1).max(80),
    subcategory: nullableText(80).default(null),
    layer_role: z.enum(WARDROBE_ITEM_ROLES).nullable().default(null),

    primary_color_hex: z.string().regex(HEX_COLOR).nullable().default(null),
    secondary_color_hex: z.string().regex(HEX_COLOR).nullable().default(null),
    color_names: stringList.default([]),
    pattern: nullableText(80).default(null),
    fit: nullableText(80).default(null),
    silhouette: nullableText(80).default(null),
    materials: z
      .union([
        z.record(z.string().trim().min(1).max(80), z.unknown()),
        z.array(z.unknown()).max(40),
      ])
      .default({}),
    visible_text: stringList.default([]),

    size_label: nullableText(80).default(null),
    season_tags: stringList.default([]),
    occasion_tags: stringList.default([]),
    weather_tags: stringList.default([]),
    warmth_level: level.nullable().default(null),
    formality_level: level.nullable().default(null),
    water_resistance: z.enum(WATER_RESISTANCE_LEVELS).nullable().default(null),
    care_instructions: stringList.default([]),
    condition: nullableText(80).default(null),

    favorite: z.boolean().default(false),
    availability_status: z.enum(AVAILABILITY_STATUSES).default("available"),
    wear_count: z.number().int().nonnegative().default(0),
    last_worn_at: timestamp.nullable().default(null),
    notes: z.string().trim().max(2_000).default(""),

    purchase_price: z.number().nonnegative().nullable().default(null),
    currency: z.string().regex(ISO_CURRENCY).nullable().default(null),
    purchase_date: z.string().regex(ISO_DATE).nullable().default(null),
    retailer: nullableText(160).default(null),

    metadata_confidence: z.number().min(0).max(1).nullable().default(null),
    user_confirmed_at: timestamp.nullable().default(null),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: timestamp.nullable().default(null),
  })
  .strict();

export const wardrobeItemCreateSchema = wardrobeItemSchema.omit({
  id: true,
  user_id: true,
  wear_count: true,
  last_worn_at: true,
  user_confirmed_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
});

const partialWardrobeItemCreateSchema = wardrobeItemCreateSchema.partial();

export const wardrobeItemUpdateSchema = z.unknown().transform((value, context) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length === 0
  ) {
    context.addIssue({
      code: "custom",
      message: "At least one wardrobe item field must be provided.",
    });
    return z.NEVER;
  }

  const parsed = partialWardrobeItemCreateSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
    return z.NEVER;
  }

  const suppliedKeys = new Set(Object.keys(value));
  return Object.fromEntries(
    Object.entries(parsed.data).filter(([key]) => suppliedKeys.has(key)),
  ) as Partial<z.output<typeof wardrobeItemCreateSchema>>;
});
