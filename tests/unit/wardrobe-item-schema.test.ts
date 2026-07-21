import { describe, expect, it } from "vitest";

import {
  wardrobeItemCreateSchema,
  wardrobeItemSchema,
  wardrobeItemUpdateSchema,
} from "@/features/wardrobe/schemas";

import { ITEM_IDS, USER_ID } from "./fixtures";

const minimumItem = {
  id: ITEM_IDS.topA,
  user_id: USER_ID,
  name: "  White shirt  ",
  category: "tops",
  created_at: "2026-07-20T12:00:00.000Z",
  updated_at: "2026-07-20T12:00:00.000Z",
};

describe("wardrobe item schemas", () => {
  it("normalizes required text and applies safe defaults", () => {
    const item = wardrobeItemSchema.parse(minimumItem);

    expect(item.name).toBe("White shirt");
    expect(item.status).toBe("active");
    expect(item.availability_status).toBe("available");
    expect(item.color_names).toEqual([]);
    expect(item.wear_count).toBe(0);
  });

  it("rejects malformed, out-of-range, and unknown data", () => {
    expect(() =>
      wardrobeItemSchema.parse({
        ...minimumItem,
        primary_color_hex: "navy",
        warmth_level: 6,
        leaked_secret: "must not survive validation",
      }),
    ).toThrow();
  });

  it("keeps ownership and audit fields out of create input", () => {
    const valid = wardrobeItemCreateSchema.safeParse({ name: "Jeans", category: "bottoms" });
    const invalid = wardrobeItemCreateSchema.safeParse({
      name: "Jeans",
      category: "bottoms",
      user_id: USER_ID,
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("requires at least one field in an update", () => {
    expect(wardrobeItemUpdateSchema.safeParse({}).success).toBe(false);
    expect(wardrobeItemUpdateSchema.parse({ favorite: true })).toEqual({ favorite: true });
  });
});
