import { detectCues } from "./detect-cues";

// WardrobeItem has no dedicated garment-length field, so this is documented,
// deliberate string-heuristic keyword matching against subcategory/fit text
// -- consistent with how the rest of the deterministic layer already infers
// missing structured signal from free text (e.g. item-role.ts's category
// normalization).
export function evaluateLengthProportion(
  top: { subcategory: string | null; fit: string | null },
  bottom: { subcategory: string | null; fit: string | null },
): { balanced: boolean; guidance: string } {
  const topText = `${top.subcategory ?? ""} ${top.fit ?? ""}`;
  const bottomText = `${bottom.subcategory ?? ""} ${bottom.fit ?? ""}`;
  const topCues = detectCues(topText);
  const bottomCues = detectCues(bottomText);

  if (topCues.has("cropped")) {
    if (bottomCues.has("high_rise") || bottomCues.has("slim")) {
      return {
        balanced: true,
        guidance:
          "Cropped top with a high-rise or slim bottom follows classic rule-of-thirds proportion.",
      };
    }
    if (bottomCues.has("wide")) {
      return {
        balanced: true,
        guidance: "Cropped top with a wide-leg bottom is a common, balanced silhouette.",
      };
    }
    return {
      balanced: true,
      guidance: "Cropped top; no conflicting proportion cue on the bottom.",
    };
  }

  if (topCues.has("long")) {
    if (bottomCues.has("slim") || bottomCues.has("high_rise")) {
      return {
        balanced: true,
        guidance: "Long/tunic top over a slim or straight bottom keeps proportions readable.",
      };
    }
    if (bottomCues.has("wide")) {
      return {
        balanced: false,
        guidance:
          "A long top over a wide-leg bottom can hide the waistline entirely -- worth flagging.",
      };
    }
  }

  return { balanced: true, guidance: "No strong proportion signal detected; treat as flexible." };
}
