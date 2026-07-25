import type { OutfitItemRole } from "@/features/outfits/types";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const roles = new Set<OutfitItemRole>([
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
]);

export const quickPrompts = [
  "Dress me for work tomorrow",
  "A casual rainy-day look",
  "Plan my outfits for next week",
  "Pack me for 3 days in Chicago",
  "What have I not worn this year?",
  "Do I own a blue blazer?",
];

export const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);
