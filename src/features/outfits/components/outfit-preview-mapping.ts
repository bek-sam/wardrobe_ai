import type { OutfitPreview } from "./outfit-card.types";

import { roleColors } from "./role-presentation.data";
import type { OutfitRecord } from "./outfits-manager.types";

export function asPreview(outfit: OutfitRecord): OutfitPreview {
  const pieces = [...(outfit.outfit_items ?? [])]
    .sort((first, second) => first.sort_order - second.sort_order)
    .filter((piece) => piece.role in roleColors)
    .map((piece) => ({ category: piece.role, ...roleColors[piece.role] }));
  const wearLogs = [...(outfit.wear_logs ?? [])].sort((first, second) =>
    second.worn_at.localeCompare(first.worn_at),
  );
  const wearSummary = wearLogs.length
    ? `Worn ${wearLogs.length} ${wearLogs.length === 1 ? "time" : "times"}; last worn ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(wearLogs[0]!.worn_at))}.`
    : null;
  return {
    id: outfit.id,
    name: outfit.name,
    occasion: outfit.occasion ?? (outfit.source === "ai" ? "AI-created look" : "Saved look"),
    detail: [
      outfit.explanation ??
        `${pieces.length} ${pieces.length === 1 ? "saved piece" : "saved pieces"} in this outfit.`,
      wearSummary,
    ]
      .filter(Boolean)
      .join(" "),
    pieces,
    favorite: outfit.favorite,
  };
}
