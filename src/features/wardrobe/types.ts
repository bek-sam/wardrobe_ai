import type { z } from "zod";

import type {
  wardrobeItemCreateSchema,
  wardrobeItemSchema,
  wardrobeItemUpdateSchema,
} from "./schemas/wardrobe-item";

export const WARDROBE_ITEM_STATUSES = ["active", "archived", "donated", "sold", "lost"] as const;

export const WARDROBE_ITEM_SOURCES = ["manual", "photo", "import", "research", "legacy"] as const;

export const AVAILABILITY_STATUSES = [
  "available",
  "laundry",
  "packed",
  "loaned",
  "repair",
] as const;

export const WATER_RESISTANCE_LEVELS = [
  "none",
  "water_repellent",
  "water_resistant",
  "waterproof",
] as const;

export const WARDROBE_ITEM_ROLES = [
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
] as const;

export type WardrobeItemStatus = (typeof WARDROBE_ITEM_STATUSES)[number];
export type WardrobeItemSource = (typeof WARDROBE_ITEM_SOURCES)[number];
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];
export type WaterResistance = (typeof WATER_RESISTANCE_LEVELS)[number];
export type WardrobeItemRole = (typeof WARDROBE_ITEM_ROLES)[number];

export type WardrobeItem = z.output<typeof wardrobeItemSchema>;
export type WardrobeItemCreateInput = z.input<typeof wardrobeItemCreateSchema>;
export type WardrobeItemCreate = z.output<typeof wardrobeItemCreateSchema>;
export type WardrobeItemUpdate = z.output<typeof wardrobeItemUpdateSchema>;
