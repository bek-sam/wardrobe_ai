import { describe, expect, it } from "vitest";

import { containedImageRect, pointToNormalized, projectNormalizedRect } from "@/lib/visualization";

const PORTRAIT = { width: 1024, height: 1536 };

describe("containedImageRect", () => {
  it("letterboxes horizontally in a container wider than the image", () => {
    const rect = containedImageRect(PORTRAIT, { width: 900, height: 600 });
    expect(rect.height).toBeCloseTo(600);
    expect(rect.width).toBeCloseTo(400);
    expect(rect.left).toBeCloseTo(250);
    expect(rect.top).toBeCloseTo(0);
  });

  it("letterboxes vertically in a container taller than the image", () => {
    const rect = containedImageRect(PORTRAIT, { width: 400, height: 1200 });
    expect(rect.width).toBeCloseTo(400);
    expect(rect.height).toBeCloseTo(600);
    expect(rect.top).toBeCloseTo(300);
    expect(rect.left).toBeCloseTo(0);
  });

  it("returns an empty rect rather than NaN for a zero-sized container", () => {
    expect(containedImageRect(PORTRAIT, { width: 0, height: 0 })).toEqual({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });
  });
});

describe("projectNormalizedRect", () => {
  it("maps a normalized region onto the painted area, not the container", () => {
    const projected = projectNormalizedRect(
      { x: 0.25, y: 0.5, width: 0.5, height: 0.25 },
      PORTRAIT,
      { width: 900, height: 600 },
    );
    expect(projected.left).toBeCloseTo(250 + 100);
    expect(projected.top).toBeCloseTo(300);
    expect(projected.width).toBeCloseTo(200);
    expect(projected.height).toBeCloseTo(150);
  });
});

describe("pointToNormalized", () => {
  const container = { width: 900, height: 600 };

  it("round-trips a projected region's origin", () => {
    const bounds = { x: 0.25, y: 0.5, width: 0.5, height: 0.25 };
    const projected = projectNormalizedRect(bounds, PORTRAIT, container);
    const point = pointToNormalized({ x: projected.left, y: projected.top }, PORTRAIT, container);
    expect(point?.x).toBeCloseTo(bounds.x);
    expect(point?.y).toBeCloseTo(bounds.y);
  });

  it("rejects a click inside the letterbox bar", () => {
    expect(pointToNormalized({ x: 10, y: 300 }, PORTRAIT, container)).toBeNull();
  });

  it("accepts the exact edges of the painted area", () => {
    expect(pointToNormalized({ x: 250, y: 0 }, PORTRAIT, container)).toEqual({ x: 0, y: 0 });
    expect(pointToNormalized({ x: 650, y: 600 }, PORTRAIT, container)?.x).toBeCloseTo(1);
  });
});
