import { requestJson } from "@/lib/api/request";

import { appendWearLog } from "./append-wear-log";
import type { OutfitFilter, OutfitRecord } from "./outfits-manager.types";

type Setters = {
  setOutfits: (updater: (current: OutfitRecord[]) => OutfitRecord[]) => void;
  setTotal: (updater: (current: number) => number) => void;
  setNotice: (message: string) => void;
};

export async function toggleFavoriteOutfit(
  outfit: OutfitRecord,
  activeFilter: OutfitFilter,
  setters: Setters,
) {
  const updated = await requestJson<OutfitRecord>(`/api/outfits/${outfit.id}`, {
    method: "PATCH",
    body: JSON.stringify({ favorite: !outfit.favorite }),
  });
  setters.setOutfits((current) =>
    current.map((candidate) =>
      candidate.id === updated.id ? { ...candidate, ...updated } : candidate,
    ),
  );
  if (activeFilter === "favorite" && !updated.favorite)
    setters.setTotal((current) => Math.max(0, current - 1));
  setters.setNotice(
    updated.favorite ? "Outfit added to favorites." : "Outfit removed from favorites.",
  );
}

export async function markOutfitWorn(outfit: OutfitRecord, setters: Setters) {
  const idempotencyKey = `outfit-ui-${crypto.randomUUID()}`;
  await requestJson<{ wear_log_id: string }>(`/api/outfits/${outfit.id}/wear`, {
    method: "POST",
    body: JSON.stringify({ idempotency_key: idempotencyKey }),
  });
  setters.setOutfits((current) => appendWearLog(current, outfit.id));
  setters.setNotice(`“${outfit.name}” was marked as worn.`);
}

export async function deleteOutfit(outfit: OutfitRecord, setters: Setters) {
  await requestJson<{ deleted: true; id: string }>(`/api/outfits/${outfit.id}`, {
    method: "DELETE",
  });
  setters.setOutfits((current) => current.filter((candidate) => candidate.id !== outfit.id));
  setters.setTotal((current) => Math.max(0, current - 1));
  setters.setNotice("Outfit deleted.");
}
