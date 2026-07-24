import type { WardrobeItem } from "@/features/wardrobe/types";
import type { PlannerDay } from "@/lib/ai/agents/planner-agent";
import type { PlannerResult } from "@/lib/ai/schemas/stylist";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

export function buildPlanRows(
  looks: PlannerResult["looks"],
  plannerDays: readonly PlannerDay[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
) {
  return looks.map((look) => {
    const day = plannerDays.find((candidate) => candidate.date === look.date);
    const items = look.itemIds.map((itemId, index) => {
      const item = candidateMap.get(itemId);
      const role = item ? resolveWardrobeItemRole(item) : null;
      if (!role) throw new Error("A planned item has no valid role.");
      return { item_id: itemId, role, sort_order: index };
    });
    return {
      date: look.date,
      occasion: day?.occasion ?? null,
      weather_context: day?.weather ?? {},
      name: look.title,
      explanation: look.explanation,
      confidence: look.confidence,
      items,
    };
  });
}
