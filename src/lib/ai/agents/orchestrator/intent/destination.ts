import { BLOCKED_DESTINATIONS } from "./vocabulary.data";

const TRIP_PATTERNS: readonly RegExp[] = [
  /\b(?:trip|travel(?:l?ing)?|flying|fly|driving|drive|going|heading|off|visit(?:ing)?)\s+to\s+(.+)/i,
  /\bpack(?:\s?ing)?(?:\s+me)?(?:\s+a\s+bag)?\s+for\s+(.+)/i,
  /\bin\s+([A-Z].+)/,
];

const CLAUSE_END = /[.,;:!?]|\b(?:for|next|this|on|from|with|during|over|starting|because)\b/i;
const CONNECTORS = new Set(["of", "de", "del", "la", "le", "du", "upon", "on", "the"]);

/** Last run of capitalised words, so "a rainy trip to New York" yields the city. */
function lastProperNoun(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  let run: string[] = [];
  let best: string[] = [];
  for (const word of words) {
    if (/^[A-Z][\w'’-]*$/.test(word)) run.push(word);
    else if (run.length > 0 && CONNECTORS.has(word.toLowerCase())) run.push(word);
    else {
      if (run.length > best.length) best = run;
      run = [];
    }
  }
  return (run.length > best.length ? run : best).slice(0, 4).join(" ");
}

/** Destination a packing request names, or null when it names none. */
export function extractTripDestination(request: string): string | null {
  for (const pattern of TRIP_PATTERNS) {
    const captured = pattern.exec(request)?.[1];
    if (!captured) continue;
    const name = lastProperNoun(captured.split(CLAUSE_END)[0] ?? "");
    if (name && !BLOCKED_DESTINATIONS.has(name.toLowerCase())) return name.slice(0, 80);
  }
  return null;
}
