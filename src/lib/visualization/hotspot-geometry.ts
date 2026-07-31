import type { GarmentHotspot, NormalizedPoint, NormalizedRect } from "./types";

/** Axis-aligned bounds for either hotspot shape, so callers stay shape-agnostic. */
export function hotspotBounds(hotspot: GarmentHotspot): NormalizedRect {
  if (hotspot.version === 1) return hotspot.bounds;
  const xs = hotspot.points.map((point) => point.x);
  const ys = hotspot.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function hotspotArea(hotspot: GarmentHotspot): number {
  const bounds = hotspotBounds(hotspot);
  return Math.max(0, bounds.width) * Math.max(0, bounds.height);
}

function pointInPolygon(point: NormalizedPoint, points: readonly NormalizedPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index];
    const last = points[previous];
    if (!current || !last) continue;
    const straddles = current.y > point.y !== last.y > point.y;
    if (!straddles) continue;
    const crossingX =
      ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) + current.x;
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

export function hotspotContains(hotspot: GarmentHotspot, point: NormalizedPoint): boolean {
  if (hotspot.version === 2) return pointInPolygon(point, hotspot.points);
  const { x, y, width, height } = hotspot.bounds;
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}
