import { describe, expect, it } from "vitest";

import type { OutfitItemRole } from "@/features/outfits/types";
import {
  buildSnapshotHotspots,
  isUsableHotspot,
  resolveHotspotHit,
  VISUALIZATION_ROLE_Z_INDEX,
  type GarmentHotspot,
  type NormalizedRect,
} from "@/lib/visualization";

function hotspot(
  itemId: string,
  role: OutfitItemRole,
  bounds: NormalizedRect,
  confidence = 0.9,
): GarmentHotspot {
  return {
    version: 1,
    itemId,
    role,
    shape: "rect",
    bounds,
    confidence,
    source: "model",
    zIndex: VISUALIZATION_ROLE_Z_INDEX[role],
  };
}

describe("hotspot hit resolution", () => {
  it("returns nothing when the point is outside every region", () => {
    const regions = [hotspot("a", "top", { x: 0.3, y: 0.2, width: 0.4, height: 0.2 })];
    expect(resolveHotspotHit(regions, { x: 0.05, y: 0.05 }).kind).toBe("none");
  });

  it("picks the higher layer when zIndex differs", () => {
    const inner = hotspot("top-id", "top", { x: 0.3, y: 0.2, width: 0.4, height: 0.3 });
    const outer = hotspot("layer-id", "layer", { x: 0.25, y: 0.18, width: 0.5, height: 0.34 });
    const hit = resolveHotspotHit([inner, outer], { x: 0.5, y: 0.3 });
    expect(hit.kind).toBe("single");
    expect(hit.kind === "single" && hit.hotspot.itemId).toBe("layer-id");
  });

  it("prefers a materially smaller region at the same layer", () => {
    const small = hotspot("small", "top", { x: 0.4, y: 0.3, width: 0.1, height: 0.1 });
    const large = { ...hotspot("large", "top", { x: 0.1, y: 0.1, width: 0.7, height: 0.7 }) };
    const hit = resolveHotspotHit([small, large], { x: 0.45, y: 0.35 });
    expect(hit.kind === "single" && hit.hotspot.itemId).toBe("small");
  });

  it("asks the user when two same-layer regions are comparably sized", () => {
    const first = hotspot("first", "top", { x: 0.3, y: 0.3, width: 0.3, height: 0.3 });
    const second = hotspot("second", "top", { x: 0.32, y: 0.31, width: 0.29, height: 0.29 });
    const hit = resolveHotspotHit([first, second], { x: 0.45, y: 0.45 });
    expect(hit.kind).toBe("ambiguous");
    expect(hit.kind === "ambiguous" && hit.hotspots).toHaveLength(2);
  });
});

describe("hotspot validation and fallback", () => {
  it("rejects a low-confidence region", () => {
    expect(
      isUsableHotspot(hotspot("a", "top", { x: 0.3, y: 0.2, width: 0.3, height: 0.2 }, 0.2)),
    ).toBe(false);
  });

  it("rejects a region that is implausibly large for its role", () => {
    expect(isUsableHotspot(hotspot("a", "shoes", { x: 0, y: 0, width: 0.9, height: 0.9 }))).toBe(
      false,
    );
  });

  it("gives every snapshot item a hotspot, falling back to a body zone", () => {
    const items = [
      { itemId: "top-id", role: "top" as const },
      { itemId: "shoes-id", role: "shoes" as const },
    ];
    const located = [hotspot("top-id", "top", { x: 0.3, y: 0.2, width: 0.3, height: 0.2 })];
    const built = buildSnapshotHotspots(items, located);

    expect(built).toHaveLength(2);
    expect(built[0]?.source).toBe("model");
    // The unlocated shoes still get a selectable, clearly-approximate region.
    expect(built[1]?.source).toBe("fallback");
    expect(built[1]?.itemId).toBe("shoes-id");
  });

  it("never marks a model region as user-confirmed", () => {
    const built = buildSnapshotHotspots(
      [{ itemId: "top-id", role: "top" }],
      [hotspot("top-id", "top", { x: 0.3, y: 0.2, width: 0.3, height: 0.2 })],
    );
    expect(built[0]?.source).not.toBe("user_corrected");
  });
});
