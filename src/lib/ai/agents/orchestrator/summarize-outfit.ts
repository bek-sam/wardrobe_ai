import type { ValidatedOutfit } from "@/lib/recommendation/outfit-validation";

export function summarizeValidatedOutfit(outfit: ValidatedOutfit) {
  return {
    title: outfit.title,
    items: outfit.items,
    explanation: outfit.explanation,
    warnings: outfit.warnings,
    confidence: outfit.confidence,
    missing_category: outfit.missing_category,
    follow_up_question: outfit.follow_up_question,
  };
}
