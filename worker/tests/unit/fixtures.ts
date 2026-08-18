import { wardrobeItemSchema } from "@/features/wardrobe/schemas";
import type { WardrobeItem } from "@/features/wardrobe";

export const USER_ID = "00000000-0000-4000-8000-000000000001";
export const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";

export const ITEM_IDS = {
  topA: "10000000-0000-4000-8000-000000000001",
  topB: "10000000-0000-4000-8000-000000000002",
  bottomA: "20000000-0000-4000-8000-000000000001",
  bottomB: "20000000-0000-4000-8000-000000000002",
  dress: "25000000-0000-4000-8000-000000000001",
  layer: "30000000-0000-4000-8000-000000000001",
  shoes: "40000000-0000-4000-8000-000000000001",
  shoesB: "40000000-0000-4000-8000-000000000002",
  shoesC: "40000000-0000-4000-8000-000000000003",
  accessory: "50000000-0000-4000-8000-000000000001",
  unknown: "90000000-0000-4000-8000-000000000001",
} as const;

export function makeWardrobeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return wardrobeItemSchema.parse({
    id: ITEM_IDS.topA,
    user_id: USER_ID,
    name: "Navy cotton shirt",
    category: "tops",
    layer_role: "top",
    primary_color_hex: "#1b2a4a",
    color_names: ["navy"],
    warmth_level: 2,
    formality_level: 3,
    metadata_confidence: 0.9,
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  });
}
