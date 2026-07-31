import { AVAILABILITY_LABELS } from "./role-label.data";

type Fact = { label: string; value: string };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function list(value: unknown): string | null {
  return Array.isArray(value) && value.length > 0 ? value.map(String).join(", ") : null;
}

/**
 * Builds the detail rows from the owned wardrobe record only. Nothing here is
 * read from the generated image or from the localization model — a rendered
 * pixel must never become a product fact about a garment the user owns.
 */
export function garmentFacts(item: Record<string, unknown> | null): Fact[] {
  if (!item) return [];
  const materials = item.materials;
  const candidates: [string, string | null][] = [
    ["Brand", text(item.brand)],
    ["Category", text(item.subcategory) ?? text(item.category)],
    ["Colors", list(item.color_names)],
    ["Pattern", text(item.pattern)],
    ["Fit", text(item.fit)],
    ["Silhouette", text(item.silhouette)],
    ["Material", Array.isArray(materials) ? list(materials) : null],
    ["Size", text(item.size_label)],
    ["Care", list(item.care_instructions)],
    ["Status", AVAILABILITY_LABELS[String(item.availability_status)] ?? null],
    ["Worn", typeof item.wear_count === "number" ? `${item.wear_count} times` : null],
    [
      "Last worn",
      text(item.last_worn_at) ? new Date(String(item.last_worn_at)).toLocaleDateString() : null,
    ],
  ];
  return candidates.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/** True when the item's metadata is uncertain enough to be worth flagging. */
export function hasLowConfidenceMetadata(item: Record<string, unknown> | null): boolean {
  const confidence = item?.metadata_confidence;
  return typeof confidence === "number" && confidence < 0.6;
}
