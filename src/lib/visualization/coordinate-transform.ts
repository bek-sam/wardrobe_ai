import type { NormalizedPoint, NormalizedRect, PixelRect, Size } from "./types";

/**
 * Where an `object-fit: contain` image actually paints inside its container,
 * in CSS pixels relative to the container's top-left. Everything here is CSS
 * pixels: device-pixel-ratio never enters the calculation, so a retina screen
 * cannot double the offsets.
 */
export function containedImageRect(natural: Size, container: Size): PixelRect {
  if (
    !Number.isFinite(natural.width) ||
    !Number.isFinite(natural.height) ||
    natural.width <= 0 ||
    natural.height <= 0 ||
    container.width <= 0 ||
    container.height <= 0
  ) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const scale = Math.min(container.width / natural.width, container.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
}

/** Projects a 0..1 rect on the natural image onto the painted image area. */
export function projectNormalizedRect(
  bounds: NormalizedRect,
  natural: Size,
  container: Size,
): PixelRect {
  const painted = containedImageRect(natural, container);
  return {
    left: painted.left + bounds.x * painted.width,
    top: painted.top + bounds.y * painted.height,
    width: bounds.width * painted.width,
    height: bounds.height * painted.height,
  };
}

/**
 * Inverse mapping for pointer events. Returns null for a point in the
 * letterbox bars, which belong to the container and not to the image.
 */
export function pointToNormalized(
  point: NormalizedPoint,
  natural: Size,
  container: Size,
): NormalizedPoint | null {
  const painted = containedImageRect(natural, container);
  if (painted.width <= 0 || painted.height <= 0) return null;
  const x = (point.x - painted.left) / painted.width;
  const y = (point.y - painted.top) / painted.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
