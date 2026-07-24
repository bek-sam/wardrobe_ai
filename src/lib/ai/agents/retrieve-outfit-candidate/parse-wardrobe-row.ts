import { wardrobeItemSchema } from "@/features/wardrobe/schemas";
import type { WardrobeItem } from "@/features/wardrobe/types";

export function parseWardrobeRow(row: Record<string, unknown>): WardrobeItem {
  const keys = Object.keys(wardrobeItemSchema.shape);
  return wardrobeItemSchema.parse(Object.fromEntries(keys.map((key) => [key, row[key]])));
}
