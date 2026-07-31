/** create_user_outfit returns either the row or the bare id, depending on shape. */
export function savedOutfitIdOf(result: unknown): string | null {
  if (typeof result === "string") return result;
  const id = (result as { id?: unknown })?.id;
  return typeof id === "string" ? id : null;
}
