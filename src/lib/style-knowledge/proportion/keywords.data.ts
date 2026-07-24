export type LengthCue = "cropped" | "long" | "high_rise" | "wide" | "slim" | "regular";

export const LENGTH_KEYWORDS: readonly [LengthCue, RegExp][] = [
  ["cropped", /\bcrop(ped)?\b/i],
  ["long", /\blong(line)?\b|\btunic\b|\bmaxi\b/i],
  ["high_rise", /\bhigh[\s-]?rise\b|\bhigh[\s-]?waist(ed)?\b/i],
  ["wide", /\bwide[\s-]?leg\b|\bflare[d]?\b|\bbaggy\b/i],
  ["slim", /\bslim\b|\bskinny\b|\bstraight\b/i],
];
