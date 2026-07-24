// materials is stored as jsonb (an object or array of unknown shape); this
// flattens whatever the model/user entered into plain keyword strings for
// the style-knowledge material classifiers, which only do keyword matching.
export function flattenMaterials(materials: unknown): string[] {
  if (Array.isArray(materials)) {
    return materials.filter((value): value is string => typeof value === "string");
  }
  if (materials && typeof materials === "object") {
    return Object.values(materials).filter((value): value is string => typeof value === "string");
  }
  return [];
}
