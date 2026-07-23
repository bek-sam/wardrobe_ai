import type { ColorHarmonyScheme } from "./color-harmony.types";

export function describeColorSchemeGuidance(scheme: ColorHarmonyScheme): string {
  switch (scheme) {
    case "monochrome":
      return "A single color family carried across the outfit at varying depths -- reads as deliberate and cohesive.";
    case "neutral_with_accent":
      return "Neutral base with one accent color doing the work -- safe and versatile.";
    case "analogous":
      return "Adjacent hues on the color wheel -- harmonious without being flat.";
    case "complementary":
      return "Opposite hues anchored by at least one neutral -- higher-contrast but still balanced.";
    case "triadic":
      return "Three evenly-spaced hues -- bold; works best when one color clearly leads.";
    case "clashing":
      return "Multiple competing hues with no neutral anchor -- likely reads as uncoordinated.";
  }
}
