import { AVAILABILITY_OPTIONS } from "@/features/wardrobe/constants";
import type { AvailabilityStatus, WardrobeItemStatus } from "@/features/wardrobe/types";

export function WardrobeFilterAvailabilityStatus({
  availability,
  onAvailability,
  itemStatus,
  onItemStatus,
}: {
  availability: AvailabilityStatus | "";
  onAvailability: (value: AvailabilityStatus | "") => void;
  itemStatus: WardrobeItemStatus | "";
  onItemStatus: (value: WardrobeItemStatus | "") => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Availability</span>
        <select
          className="select-input"
          onChange={(event) => onAvailability(event.target.value as AvailabilityStatus | "")}
          value={availability}
        >
          <option value="">Any availability</option>
          {AVAILABILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Item status</span>
        <select
          className="select-input"
          onChange={(event) => onItemStatus(event.target.value as WardrobeItemStatus | "")}
          value={itemStatus}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="donated">Donated</option>
          <option value="sold">Sold</option>
          <option value="lost">Lost</option>
        </select>
      </label>
    </>
  );
}
