import type { IntentDateRange } from "../intent";

/** Stable, timezone-free label ("Mon, Jul 27") for answer text. */
export function formatDayLabel(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatRangeLabel(window: IntentDateRange) {
  return window.dayCount === 1
    ? formatDayLabel(window.startDate)
    : `${formatDayLabel(window.startDate)} – ${formatDayLabel(window.endDate)}`;
}
