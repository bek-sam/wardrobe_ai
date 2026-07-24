import type { TemperatureBand } from "@/lib/weather";

export function warmthToBand(warmthLevel: number | null): TemperatureBand {
  if (warmthLevel === null) return "mild";
  if (warmthLevel <= 1) return "hot";
  if (warmthLevel === 2) return "warm";
  if (warmthLevel === 3) return "mild";
  if (warmthLevel === 4) return "cool";
  return "cold";
}
