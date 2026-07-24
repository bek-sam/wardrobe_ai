import type { ArchetypeInputItem } from "./types";

export function textOf(item: ArchetypeInputItem) {
  return `${item.category} ${item.pattern ?? ""} ${item.silhouette ?? ""}`.toLowerCase();
}
