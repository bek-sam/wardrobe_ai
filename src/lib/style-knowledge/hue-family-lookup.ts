import { HUE_FAMILIES, HUE_FAMILY_ALIASES, NEUTRALS } from "./hue-families.data";

export function normalize(name: string) {
  return name.trim().toLowerCase();
}

export function hueFamilyOf(colorName: string): string | null {
  const normalized = normalize(colorName);
  if (NEUTRALS.has(normalized)) return null;
  if (HUE_FAMILIES.includes(normalized)) return normalized;
  return HUE_FAMILY_ALIASES[normalized] ?? null;
}
