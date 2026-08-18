type LengthCue = "cropped" | "long" | "high_rise" | "wide" | "slim";

const LENGTH_KEYWORDS: readonly [LengthCue, RegExp][] = [
  ["cropped", /\bcrop(ped)?\b/i],
  ["long", /\blong(line)?\b|\btunic\b|\bmaxi\b/i],
  ["high_rise", /\bhigh[\s-]?rise\b|\bhigh[\s-]?waist(ed)?\b/i],
  ["wide", /\bwide[\s-]?leg\b|\bflare[d]?\b|\bbaggy\b/i],
  ["slim", /\bslim\b|\bskinny\b|\bstraight\b/i],
];

function detectCues(text: string): Set<LengthCue> {
  const cues = new Set<LengthCue>();
  for (const [cue, pattern] of LENGTH_KEYWORDS) {
    if (pattern.test(text)) cues.add(cue);
  }
  return cues;
}

// WardrobeItem has no dedicated garment-length field, so this is documented,
// deliberate string-heuristic matching against subcategory/fit text.
export function evaluateLengthProportion(
  top: { subcategory: string | null; fit: string | null },
  bottom: { subcategory: string | null; fit: string | null },
): { balanced: boolean; guidance: string } {
  const topCues = detectCues(`${top.subcategory ?? ""} ${top.fit ?? ""}`);
  const bottomCues = detectCues(`${bottom.subcategory ?? ""} ${bottom.fit ?? ""}`);

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
