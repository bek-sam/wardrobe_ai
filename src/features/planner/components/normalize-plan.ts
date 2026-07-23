import { isObject, safeNullableString, safeString } from "@/lib/api/normalize";

import { normalizePlanItems } from "./normalize-plan-items";
import { weatherFrom } from "./normalize-weather";
import { relationObject } from "./relation-object";
import { uuidPattern } from "./planner-constants.data";
import type { PlanView } from "./planner.types";

export function normalizePlan(value: unknown): PlanView | null {
  if (!isObject(value) || typeof value.id !== "string" || !uuidPattern.test(value.id)) return null;
  const plannedDate = safeString(value.planned_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return null;
  const status = ["planned", "worn", "skipped"].includes(safeString(value.status))
    ? (value.status as "planned" | "worn" | "skipped")
    : "planned";
  const outfit = relationObject(value.outfits);
  const outfitId =
    typeof value.outfit_id === "string" && uuidPattern.test(value.outfit_id)
      ? value.outfit_id
      : null;

  return {
    id: value.id,
    plannedDate,
    startTime: safeNullableString(value.start_time),
    occasion: safeNullableString(value.occasion),
    locationName: safeNullableString(value.location_name),
    eventTitle: safeNullableString(value.event_title),
    status,
    outfitId,
    outfitName: outfit ? safeNullableString(outfit.name) : null,
    explanation: outfit ? safeNullableString(outfit.explanation) : null,
    weather: weatherFrom(value.weather_snapshot),
    items: normalizePlanItems(outfit),
  };
}
