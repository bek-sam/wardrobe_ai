import { boundDestination, stripDurationPrefix, trimDestinationClause } from "./destination-clean";
import { BLOCKED_DESTINATIONS } from "./vocabulary.data";

/**
 * Explicit travel phrases, most specific first. All case-insensitive: a
 * destination is recognised from what the sentence says, not from whether the
 * user happened to capitalise it, so "pack me for chicago" resolves the same
 * way "Pack me for Chicago" does. The original casing is preserved in the
 * result -- this reads the request, it does not respell it.
 */
const TRAVEL_PATTERNS: readonly RegExp[] = [
  /\b(?:trip|travel(?:l?ing)?|flight|flying|fly|driving|drive|going|heading|off|visit(?:ing)?)\s+to\s+(.+)/i,
  /\bpack(?:\s?ing|s|ed)?(?:\s+me)?(?:\s+(?:a|my)\s+(?:bag|suitcase|case))?\s+for\s+(.+)/i,
  /\b(?:staying|stay|holiday(?:ing)?|vacation(?:ing)?)\s+in\s+(.+)/i,
  // "visiting Kyoto" takes no preposition, unlike "flying to Kyoto". Safe as an
  // explicit phrase because a non-place capture ("visiting the office") is
  // still rejected by the non-destination vocabulary.
  /\bvisit(?:ing|s)?\s+(.+)/i,
];

/**
 * "in <place>" is far weaker evidence than "to <place>" -- "what should I wear
 * in rain" names no trip -- so it only counts when the sentence is already
 * about travelling somewhere.
 */
const WEAK_IN_PATTERN = /\bin\s+(.+)/i;
const TRAVEL_MARKER =
  /\b(?:pack(?:\s?ing|s|ed)?|trip|travel(?:l?ing)?|vacation|holiday|suitcase|luggage|carry[-\s]?on|flying|flight)\b/i;

function candidateFrom(captured: string | undefined) {
  if (!captured) return null;
  const name = boundDestination(stripDurationPrefix(trimDestinationClause(captured)));
  return name && !BLOCKED_DESTINATIONS.has(name.toLowerCase()) ? name : null;
}

/**
 * Destination a packing request names, or null when it names none. Purely
 * deterministic: no model call, no geocoder lookup, no network at all.
 */
export function extractTripDestination(request: string): string | null {
  for (const pattern of TRAVEL_PATTERNS) {
    const name = candidateFrom(pattern.exec(request)?.[1]);
    if (name) return name;
  }
  if (!TRAVEL_MARKER.test(request)) return null;
  return candidateFrom(WEAK_IN_PATTERN.exec(request)?.[1]);
}
