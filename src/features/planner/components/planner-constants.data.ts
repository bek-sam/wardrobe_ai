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

export const previewDays = [
  { date: "2026-07-21", occasion: "Client lunch", colors: ["#ddd4c2", "#293647", "#9c7250"] },
  { date: "2026-07-22", occasion: "Office", colors: ["#455746", "#d8d0bf", "#c9bca3"] },
  { date: "2026-07-23", occasion: "Open day", colors: [] },
] as const;
