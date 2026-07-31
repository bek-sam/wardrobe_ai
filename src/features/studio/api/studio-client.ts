import { requestJson } from "@/lib/api/request";

import type { StudioVariantsResponse } from "../types";

export type StudioRequestInput = {
  message: string;
  date: string;
  location: string | null;
  occasion: string | null;
  indoorOutdoor: "indoor" | "outdoor" | "mixed" | null;
  lockedItemIds: string[];
};

export function fetchOutfitVariants(input: StudioRequestInput, signal?: AbortSignal) {
  return requestJson<StudioVariantsResponse>("/api/outfits/variants", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
}

export function fetchItemCutouts(itemIds: readonly string[], signal?: AbortSignal) {
  return requestJson<{ cutouts: { itemId: string; url: string }[] }>("/api/items/cutouts", {
    method: "POST",
    body: JSON.stringify({ itemIds }),
    signal,
  });
}
