import type { TimeOfDay } from "./constants.data";

// Checked independently of occasion category: time cues ("dinner tonight" vs
// "dinner tomorrow morning") don't reliably correlate with which occasion
// category matched, so these are detected directly from the raw text.
const TIME_OF_DAY_PATTERNS: readonly [TimeOfDay, RegExp][] = [
  ["morning", /\bmorning\b|\bbreakfast\b|\bbrunch\b/i],
  ["afternoon", /\bafternoon\b|\blunch\b|\bmidday\b/i],
  ["evening", /\bevening\b|\bdinner\b|\btonight\b|\bafter work\b/i],
  ["night", /\bnight\b|\blate[\s-]?night\b/i],
];

export function detectTimeOfDay(text: string): TimeOfDay {
  for (const [timeOfDay, pattern] of TIME_OF_DAY_PATTERNS) {
    if (pattern.test(text)) return timeOfDay;
  }
  return "unspecified";
}
