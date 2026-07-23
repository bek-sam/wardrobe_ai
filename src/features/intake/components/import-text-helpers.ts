export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function csv(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function materialName(materials: Record<string, unknown>) {
  if (typeof materials.apparent === "string") return materials.apparent;
  const match = Object.values(materials).find((value) => typeof value === "string");
  return typeof match === "string" ? match : "";
}
