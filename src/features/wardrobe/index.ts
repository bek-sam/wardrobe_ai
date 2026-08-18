import type { z } from "zod";
import type {
  wardrobeItemCreateSchema,
  wardrobeItemSchema,
  wardrobeItemUpdateSchema,
} from "./schemas";
import {
  AVAILABILITY_STATUSES,
  WARDROBE_ITEM_ROLES,
  WARDROBE_ITEM_SOURCES,
  WARDROBE_ITEM_STATUSES,
  WATER_RESISTANCE_LEVELS,
} from "./schemas";

export {
  AVAILABILITY_STATUSES,
  WARDROBE_ITEM_ROLES,
  WARDROBE_ITEM_SOURCES,
  WARDROBE_ITEM_STATUSES,
  WATER_RESISTANCE_LEVELS,
};

export type WardrobeItem = z.output<typeof wardrobeItemSchema>;

export type WardrobeItemCreateInput = z.input<typeof wardrobeItemCreateSchema>;

export type WardrobeItemCreate = z.output<typeof wardrobeItemCreateSchema>;

export type WardrobeItemUpdate = z.output<typeof wardrobeItemUpdateSchema>;

export const AVAILABILITY_OPTIONS: Array<{ label: string; value: AvailabilityStatus }> = [
  { label: "Available", value: "available" },
  { label: "In laundry", value: "laundry" },
  { label: "Packed", value: "packed" },
  { label: "Loaned out", value: "loaned" },
  { label: "Needs repair", value: "repair" },
];

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = Object.fromEntries(
  AVAILABILITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AvailabilityStatus, string>;

export type WardrobeItemStatus = (typeof WARDROBE_ITEM_STATUSES)[number];

export type WardrobeItemSource = (typeof WARDROBE_ITEM_SOURCES)[number];

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export type WaterResistance = (typeof WATER_RESISTANCE_LEVELS)[number];

export type WardrobeItemRole = (typeof WARDROBE_ITEM_ROLES)[number];

const CATEGORY_ROLE_MAP: Readonly<Record<string, WardrobeItemRole>> = {
  upperbody: "top",
  top: "top",
  tops: "top",
  shirt: "top",
  shirts: "top",
  blouse: "top",
  sweater: "top",
  knitwear: "top",
  tee: "top",
  tshirt: "top",
  lowerbody: "bottom",
  bottom: "bottom",
  bottoms: "bottom",
  pants: "bottom",
  trousers: "bottom",
  jeans: "bottom",
  skirt: "bottom",
  shorts: "bottom",
  wholebody: "dress",
  dress: "dress",
  dresses: "dress",
  wholebodyup: "layer",
  layer: "layer",
  outerwear: "layer",
  jacket: "layer",
  jackets: "layer",
  coat: "layer",
  coats: "layer",
  shoes: "shoes",
  shoe: "shoes",
  footwear: "shoes",
  accessoriesup: "accessory",
  accessory: "accessory",
  accessories: "accessory",
};

export function resolveWardrobeItemRole(
  item: Pick<WardrobeItem, "layer_role" | "category" | "subcategory">,
): WardrobeItemRole | null {
  if (item.layer_role) return item.layer_role;
  for (const value of [item.subcategory, item.category]) {
    if (!value) continue;
    const role = CATEGORY_ROLE_MAP[value.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (role) return role;
  }
  return null;
}
