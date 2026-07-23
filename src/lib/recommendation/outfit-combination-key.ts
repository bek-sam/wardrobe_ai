export function outfitCombinationKey(itemIds: readonly string[]) {
  return [...new Set(itemIds)].sort().join(":");
}
