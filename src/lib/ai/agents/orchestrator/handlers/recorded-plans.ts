import type { PlanDayView } from "../answers.types";

/**
 * The exact shape save_generated_week already accepts, and nothing else.
 *
 * This is what a chat plan can later be saved from, so it is deliberately the
 * narrowest possible record: owned item IDs with their resolved roles and sort
 * order, the day's own copy, and the same public weather context the answer
 * already showed the user. No prompts, no reasoning, no profile data, no
 * wardrobe rows, no coordinates or resolved private location -- PlanDayView's
 * weather is already the published subset (place name, min/max, precipitation
 * probability, constraint tags).
 */
export type RecordedPlanDay = {
  date: string;
  occasion: string | null;
  weather_context: Record<string, unknown>;
  name: string;
  explanation: string;
  confidence: number;
  items: { item_id: string; role: string; sort_order: number }[];
};

export function buildRecordedPlans(views: readonly PlanDayView[]): RecordedPlanDay[] {
  return views.map((view) => ({
    date: view.date,
    occasion: view.occasion,
    weather_context: view.weather ? { ...view.weather } : {},
    name: view.title,
    explanation: view.explanation,
    confidence: view.confidence,
    items: view.items.map((item) => ({
      item_id: item.item_id,
      role: item.role,
      sort_order: item.sort_order,
    })),
  }));
}
