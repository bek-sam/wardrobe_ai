import type { WardrobeItem } from "@/features/wardrobe/types";
import type { CandidateScore } from "@/lib/recommendation";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

export function buildRoleShortlist(
  eligible: readonly WardrobeItem[],
  scoreById: ReadonlyMap<string, CandidateScore>,
): WardrobeItem[] {
  const byRole = new Map<string, WardrobeItem[]>();
  for (const item of eligible) {
    const role = resolveWardrobeItemRole(item);
    if (!role) continue;
    const group = byRole.get(role) ?? [];
    group.push(item);
    byRole.set(role, group);
  }
  return [...byRole.values()].flatMap((group) =>
    group
      .sort(
        (first, second) =>
          (scoreById.get(second.id)?.total ?? 0) - (scoreById.get(first.id)?.total ?? 0),
      )
      .slice(0, 10),
  );
}
