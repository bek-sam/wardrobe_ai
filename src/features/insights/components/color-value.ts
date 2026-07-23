import { namedColors } from "./named-colors.data";

export function colorValue(name: string) {
  const normalized = name.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  if (namedColors[normalized]) return namedColors[normalized];
  let hash = 0;
  for (const character of normalized) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return `hsl(${hash} 24% 42%)`;
}
