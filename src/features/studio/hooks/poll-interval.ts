import { TRYON_POLL_INTERVALS_MS } from "@/lib/visualization";

/** 1.5s, then 3s, then 5s, capped at 5s — matching the documented cadence. */
export function pollIntervalFor(attempt: number): number {
  const index = Math.min(attempt, TRYON_POLL_INTERVALS_MS.length - 1);
  return TRYON_POLL_INTERVALS_MS[index] ?? 5_000;
}

/**
 * A hidden tab still needs the eventual answer, but not at interactive speed:
 * back off hard rather than stopping, so a user who tabs away and back is not
 * left staring at a stale "generating" until the next fast tick.
 */
export function hiddenTabInterval(interval: number): number {
  return Math.max(interval, 15_000);
}
