import { describe, expect, it } from "vitest";

import { buildFoundations } from "@/lib/compilation/generate-outfit-candidates/build-foundations";
import { interleaveSeparates } from "@/lib/compilation/generate-outfit-candidates/interleave-separates";
import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";

function item(id: string): WardrobeItem {
  return { id } as WardrobeItem;
}

function groups(counts: Partial<Record<WardrobeItemRole, number>>) {
  const map = new Map<WardrobeItemRole, WardrobeItem[]>();
  for (const [role, count] of Object.entries(counts)) {
    map.set(
      role as WardrobeItemRole,
      Array.from({ length: count as number }, (_unused, index) => item(`${role}-${index}`)),
    );
  }
  return map;
}

const ids = (foundations: WardrobeItem[][]) =>
  foundations.map((foundation) => foundation.map((entry) => entry.id).join("+"));

describe("interleaveSeparates", () => {
  it("uses every top and every bottom before repeating either", () => {
    const pairs = interleaveSeparates(
      [item("t0"), item("t1"), item("t2")],
      [item("b0"), item("b1"), item("b2")],
      3,
    );
    expect(new Set(pairs.map((pair) => pair[0]!.id)).size).toBe(3);
    expect(new Set(pairs.map((pair) => pair[1]!.id)).size).toBe(3);
  });

  it("produces no duplicate pairs across the whole space", () => {
    const pairs = interleaveSeparates([item("t0"), item("t1")], [item("b0"), item("b1")], 4);
    expect(new Set(ids(pairs)).size).toBe(4);
  });

  it("returns nothing when either side is empty", () => {
    expect(interleaveSeparates([], [item("b0")], 5)).toEqual([]);
    expect(interleaveSeparates([item("t0")], [], 5)).toEqual([]);
  });
});

describe("buildFoundations", () => {
  it("never lets dresses crowd out separates entirely", () => {
    // The old order-truncating version returned ten dresses and no separates.
    const foundations = buildFoundations(groups({ dress: 10, top: 4, bottom: 4 }), 10);
    expect(foundations.filter((entry) => entry.length === 1).length).toBeGreaterThan(0);
    expect(foundations.filter((entry) => entry.length === 2).length).toBeGreaterThan(0);
  });

  it("spreads a truncated budget across distinct tops instead of one top", () => {
    // The old nested loop paired top-0 with every bottom and stopped there.
    const foundations = buildFoundations(groups({ top: 5, bottom: 5 }), 5);
    const distinctTops = new Set(foundations.map((entry) => entry[0]!.id));
    expect(distinctTops.size).toBe(5);
  });

  it("gives the whole budget to dresses when there are no separates", () => {
    const foundations = buildFoundations(groups({ dress: 6 }), 4);
    expect(foundations).toHaveLength(4);
    expect(foundations.every((entry) => entry.length === 1)).toBe(true);
  });

  it("gives the whole budget to separates when there are no dresses", () => {
    const foundations = buildFoundations(groups({ top: 3, bottom: 3 }), 6);
    expect(foundations).toHaveLength(6);
    expect(foundations.every((entry) => entry.length === 2)).toBe(true);
  });

  it("hands unused dress budget back to separates", () => {
    // One dress cannot fill half of a budget of eight; separates take the rest.
    const foundations = buildFoundations(groups({ dress: 1, top: 4, bottom: 4 }), 8);
    expect(foundations).toHaveLength(8);
    expect(foundations.filter((entry) => entry.length === 1)).toHaveLength(1);
  });

  it("hands unused separates budget back to dresses", () => {
    const foundations = buildFoundations(groups({ dress: 6, top: 1, bottom: 1 }), 6);
    expect(foundations).toHaveLength(6);
    expect(foundations.filter((entry) => entry.length === 2)).toHaveLength(1);
  });

  it("never exceeds the budget and handles a zero budget", () => {
    expect(buildFoundations(groups({ dress: 5, top: 5, bottom: 5 }), 3)).toHaveLength(3);
    expect(buildFoundations(groups({ dress: 5 }), 0)).toEqual([]);
  });

  it("emits no duplicate foundations", () => {
    const foundations = buildFoundations(groups({ dress: 3, top: 3, bottom: 3 }), 12);
    expect(new Set(ids(foundations)).size).toBe(foundations.length);
  });
});
