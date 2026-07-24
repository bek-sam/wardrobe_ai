// Surfaces what the deterministic pass couldn't pin down, so a caller (or an
// AI escalation layered on top) knows what's still worth asking about instead
// of silently guessing. Regex category matches are always exactly 0.8
// confidence, so the dress-code question is gated on formality (a black-tie-
// caliber event is worth confirming even when the category match itself is
// confident), not on confidence a second time.
export function deriveUnresolvedQuestions(
  targetFormality: number,
  confidence: number,
  dressCodeConstraints: readonly string[],
): string[] {
  const questions: string[] = [];
  if (confidence < 0.5) {
    questions.push("What's the occasion, and how dressy should it feel?");
  }
  if (targetFormality >= 4 && dressCodeConstraints.length === 0) {
    questions.push("Is there a specific dress code to follow?");
  }
  return questions;
}
