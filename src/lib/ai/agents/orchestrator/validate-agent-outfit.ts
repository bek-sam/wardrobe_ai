import type { WardrobeItem } from "@/features/wardrobe/types";
import type { runStylistAgent } from "@/lib/ai/agents/stylist-agent";
import { validateGeneratedOutfit } from "@/lib/recommendation/outfit-validation";

import { resolveOutfitItemRoles } from "./resolve-item-roles";

export function validateAgentOutfit(
  agent: Awaited<ReturnType<typeof runStylistAgent>>,
  candidates: readonly WardrobeItem[],
  userId: string,
  weatherWarning: string | null,
) {
  const items = resolveOutfitItemRoles(agent.result.itemIds, candidates);
  const validation = validateGeneratedOutfit(
    {
      title: agent.result.title,
      items,
      explanation: agent.result.explanation,
      warnings: [...(weatherWarning ? [weatherWarning] : []), ...agent.result.warnings],
      confidence: agent.result.confidence,
      missing_category: agent.result.missingCategory,
      follow_up_question: agent.result.followUpQuestion,
    },
    candidates,
    { expectedUserId: userId },
  );
  if (!validation.success) {
    throw new Error(`The generated outfit failed validation: ${validation.issues[0]?.message}`);
  }
  return validation;
}
