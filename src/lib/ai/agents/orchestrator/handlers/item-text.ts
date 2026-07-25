import type { ItemQuery } from "../intent";
import type { WardrobeSearchResult } from "@/lib/wardrobe-search";

function describeQuery(query: ItemQuery) {
  const words = [...query.colors, ...query.categories];
  return (words.length ? words : query.terms).slice(0, 4).join(" ");
}

/** States ownership plainly; the match list carries the supporting detail. */
export function itemAnswerText(query: ItemQuery, result: WardrobeSearchResult) {
  if (query.terms.length === 0) {
    return "Tell me what to look for — a colour, a garment type, or a brand — and I will check your wardrobe.";
  }
  const described = describeQuery(query);
  if (result.matchCount === 0) {
    return `No active item in your wardrobe matches “${described}”. If you own one, it may be archived or not imported yet.`;
  }

  const names = result.matches
    .slice(0, 3)
    .map((match) => match.name)
    .join(", ");
  const unavailable = result.matches.filter((match) => match.availability !== "available").length;
  const caveat = unavailable ? ` ${unavailable} of them are not available right now.` : "";
  const noun = result.matchCount === 1 ? "item" : "items";
  return `Yes — you own ${result.matchCount} ${noun} matching “${described}”: ${names}.${caveat}`;
}
