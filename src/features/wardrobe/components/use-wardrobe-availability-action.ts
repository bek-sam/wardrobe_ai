import type { Dispatch, SetStateAction } from "react";

import type { AvailabilityStatus } from "@/features/wardrobe/types";

import { applyItemUpdate } from "./apply-item-update";
import type { LiveWardrobeItem } from "./wardrobe-manager.types";

type Mutate = <T>(
  itemId: string,
  path: string,
  init: RequestInit,
  apply: (data: T) => void,
) => Promise<void>;

export function useWardrobeAvailabilityAction(
  mutate: Mutate,
  setItems: Dispatch<SetStateAction<LiveWardrobeItem[]>>,
  setTotal: Dispatch<SetStateAction<number>>,
  activeAvailability: AvailabilityStatus | "",
) {
  return (itemId: string, next: AvailabilityStatus) =>
    mutate<{ id: string; availability_status: AvailabilityStatus }>(
      itemId,
      `/api/items/${itemId}/availability`,
      { method: "POST", body: JSON.stringify({ availability_status: next }) },
      (data) => {
        const leaves =
          Boolean(activeAvailability) && data.availability_status !== activeAvailability;
        setItems((current) =>
          applyItemUpdate(
            current,
            data.id,
            "availability_status",
            data.availability_status,
            leaves,
          ),
        );
        if (leaves) setTotal((current) => Math.max(0, current - 1));
      },
    );
}
