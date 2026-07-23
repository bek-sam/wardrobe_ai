export const NEUTRALS = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "navy",
  "beige",
  "brown",
  "cream",
  "tan",
  "charcoal",
  "ivory",
  "khaki",
]);

// Coarse hue families, ordered around the color wheel, used only to classify
// adjacency/opposition -- not for any numeric scoring.
export const HUE_FAMILIES: readonly string[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
];

export const HUE_FAMILY_ALIASES: Readonly<Record<string, string>> = {
  maroon: "red",
  burgundy: "red",
  rust: "orange",
  coral: "orange",
  mustard: "yellow",
  gold: "yellow",
  olive: "green",
  mint: "green",
  turquoise: "teal",
  cyan: "teal",
  indigo: "blue",
  cobalt: "blue",
  lavender: "purple",
  violet: "purple",
  magenta: "pink",
  rose: "pink",
};
