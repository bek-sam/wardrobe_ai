export type MaterialFormalityTier = "casual" | "smart_casual" | "formal";

const CASUAL_KEYWORDS = ["denim", "fleece", "jersey", "canvas", "corduroy", "flannel"];
const FORMAL_KEYWORDS = ["silk", "satin", "wool suiting", "suiting", "cashmere", "velvet", "tweed"];
const SMART_CASUAL_KEYWORDS = ["wool", "cotton twill", "twill", "leather", "linen", "chino"];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function classifySingleMaterial(material: string): MaterialFormalityTier {
  const normalized = normalize(material);
  if (FORMAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "formal";
  if (CASUAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "casual";
  if (SMART_CASUAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "smart_casual";
  return "smart_casual";
}

export function classifyMaterialFormality(materials: readonly string[]): MaterialFormalityTier {
  if (materials.length === 0) return "smart_casual";
  const tiers = materials.map(classifySingleMaterial);
  if (tiers.includes("formal")) return "formal";
  if (tiers.every((tier) => tier === "casual")) return "casual";
  return "smart_casual";
}

export function evaluateMaterialMix(materialsByItem: readonly (readonly string[])[]): {
  harmonious: boolean;
  guidance: string;
} {
  const allMaterials = materialsByItem.flatMap((materials) => materials.map(normalize));
  const casualSyntheticCount = allMaterials.filter((material) =>
    CASUAL_KEYWORDS.some((keyword) => material.includes(keyword)),
  ).length;
  const hasFormal = allMaterials.some((material) =>
    FORMAL_KEYWORDS.some((keyword) => material.includes(keyword)),
  );
  const hasCasual = allMaterials.some((material) =>
    CASUAL_KEYWORDS.some((keyword) => material.includes(keyword)),
  );

  if (casualSyntheticCount >= 3) {
    return {
      harmonious: false,
      guidance: "Three or more casual/synthetic textures reads as low-effort.",
    };
  }
  if (hasFormal && hasCasual) {
    return {
      harmonious: true,
      guidance: "High-low material contrast (e.g. silk with denim) can read as intentional.",
    };
  }
  return { harmonious: true, guidance: "Materials are formality-consistent." };
}
