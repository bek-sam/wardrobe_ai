import { LENGTH_KEYWORDS } from "./keywords.data";
import type { LengthCue } from "./keywords.data";

export function detectCues(text: string): Set<LengthCue> {
  const cues = new Set<LengthCue>();
  for (const [cue, pattern] of LENGTH_KEYWORDS) {
    if (pattern.test(text)) cues.add(cue);
  }
  return cues;
}
