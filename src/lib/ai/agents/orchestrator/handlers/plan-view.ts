import type { WardrobeItem } from "@/features/wardrobe/types";
import type { PlannerDay } from "@/lib/ai/agents/planner-agent";
import type { PlannerResult } from "@/lib/ai/schemas/stylist";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

import type { PlanDayView, PlanDayWeather } from "../answers.types";

function dayWeather(day: PlannerDay | undefined): PlanDayWeather | null {
  if (!day?.weather) return null;
  const { snapshot, constraints, location } = day.weather;
  return {
    locationName: location?.name ?? null,
    minimumTemperatureC: snapshot.minimumTemperatureC ?? null,
    maximumTemperatureC: snapshot.maximumTemperatureC ?? null,
    precipitationProbability: snapshot.precipitationProbability ?? null,
    tags: [...constraints.tags],
  };
}

/** Resolves planner output to owned items again before it leaves the server. */
export function buildPlanDayViews(
  looks: PlannerResult["looks"],
  plannerDays: readonly PlannerDay[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
): PlanDayView[] {
  return [...looks]
    .sort((first, second) => first.date.localeCompare(second.date))
    .map((look) => {
      const day = plannerDays.find((candidate) => candidate.date === look.date);
      const items = look.itemIds.map((itemId, index) => {
        const item = candidateMap.get(itemId);
        const role = item ? resolveWardrobeItemRole(item) : null;
        if (!item || !role) throw new Error("A planned item has no valid role.");
        return {
          item_id: itemId,
          role,
          sort_order: index,
          name: item.name,
          category: item.category,
        };
      });
      return {
        date: look.date,
        title: look.title,
        explanation: look.explanation,
        confidence: look.confidence,
        occasion: day?.occasion ?? null,
        items,
        weather: dayWeather(day),
      };
    });
}
