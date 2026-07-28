import type { PackingListEntry } from "../answers.types";

export function planAnswerText(
  range: string,
  dayCount: number,
  missingCategories: readonly string[],
) {
  const gaps = missingCategories.length
    ? ` Gaps worth knowing about: ${missingCategories.slice(0, 3).join(", ")}.`
    : "";
  return `Here is a ${dayCount}-day plan for ${range}, built only from items you own and each day's forecast.${gaps} Nothing was saved — keep any look you like from the planner page.`;
}

export function packingAnswerText(
  range: string,
  dayCount: number,
  destination: string | null,
  packingList: readonly PackingListEntry[],
  essentials: readonly string[],
) {
  const where = destination ? ` for ${destination}` : "";
  const reuse = packingList.filter((entry) => entry.dayCount > 1).length;
  const notes = essentials.length ? ` Weather notes: ${essentials.join("; ")}.` : "";
  return `Pack ${packingList.length} owned pieces${where} to cover ${dayCount} days (${range}); ${reuse} of them repeat across days.${notes}`;
}
