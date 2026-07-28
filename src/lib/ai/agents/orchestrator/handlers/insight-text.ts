import type { InsightAnswer, InsightHighlight } from "../answers.types";
import type { InsightFocus } from "../intent";

function namedList(highlights: readonly InsightHighlight[], limit = 3) {
  return highlights
    .slice(0, limit)
    .map((highlight) => highlight.label)
    .join(", ");
}

/** Plain arithmetic over the user's wear logs, stated without embellishment. */
export function insightAnswerText(
  focus: InsightFocus,
  stats: InsightAnswer["stats"],
  since: string | null,
  highlights: readonly InsightHighlight[],
) {
  if (stats.itemCount === 0)
    return "Your active wardrobe is empty, so there is nothing to analyse yet.";
  if (focus === "unworn") {
    const scope = since ? `have no recorded wear since ${since}` : "have never been worn";
    if (stats.unwornCount === 0)
      return `Every one of your ${stats.itemCount} active items has been worn${since ? ` since ${since}` : ""}.`;
    return `${stats.unwornCount} of your ${stats.itemCount} active items ${scope}, starting with ${namedList(highlights)}.`;
  }
  if (focus === "least_worn") {
    return `Your least-worn active items are ${namedList(highlights)}; ${stats.neverWornCount} items have never been worn at all.`;
  }
  if (focus === "most_worn") return `You wear ${namedList(highlights)} the most.`;
  if (focus === "cost_per_wear") {
    return highlights.length
      ? `Your best cost per wear comes from ${namedList(highlights)}.`
      : "No item has both a purchase price and a recorded wear yet, so cost per wear cannot be computed.";
  }
  if (focus === "gaps") {
    return highlights.length
      ? `Coverage notes for your ${stats.itemCount} active items: ${namedList(highlights, 4)}.`
      : `Your ${stats.itemCount} active items cover every outfit role, with ${stats.possibleFoundations} possible foundations.`;
  }
  return `You have ${stats.itemCount} active items across ${highlights.length} categories (${namedList(highlights)}), ${stats.neverWornCount} of them never worn.`;
}
