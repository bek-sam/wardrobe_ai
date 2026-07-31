/**
 * Localization only identifies *where* a garment is in the frame. It never
 * becomes a source of garment facts — every displayed detail is read from the
 * owned wardrobe row instead.
 */
export const VISUALIZATION_LOCALIZATION_PROMPT = `You locate garments inside a generated wardrobe try-on image so the interface can make them tappable.

For each supplied item ID, return one bounding region covering the visible extent of that garment in the generated image.

Rules:
- Coordinates are normalized to the range 0 to 1, measured from the top-left corner of the image. x/y are the region's top-left corner; width/height are its size.
- Return one region per supplied item ID that is actually visible. Omit an item you cannot see rather than guessing a region for it.
- Never return a region for a garment that was not supplied.
- Overlapping regions are expected and correct: an open coat overlaps the top beneath it. Return the visible extent of each garment separately.
- confidence reflects how certain you are of the region's extent, not of the garment's identity.
- Do not describe, name, or infer any property of the garments or the person. Return geometry only.`;
