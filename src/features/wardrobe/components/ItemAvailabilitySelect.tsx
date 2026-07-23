import { requestJson } from "@/lib/api/request";
import { AVAILABILITY_LABELS } from "@/features/wardrobe/constants";
import type { AvailabilityStatus } from "@/features/wardrobe/types";

import type { ItemDetail } from "./item-detail.types";

export function ItemAvailabilitySelect({
  item,
  setItem,
  action,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
}) {
  return (
    <select
      aria-label="Availability"
      value={item.availability_status}
      onChange={(event) =>
        void action("availability", async () => {
          const result = await requestJson<{ availability_status: AvailabilityStatus }>(
            `/api/items/${item.id}/availability`,
            { method: "POST", body: JSON.stringify({ availability_status: event.target.value }) },
          );
          setItem((current) =>
            current ? { ...current, availability_status: result.availability_status } : current,
          );
        })
      }
    >
      {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
