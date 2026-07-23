import { PencilSimple, Trash } from "@phosphor-icons/react";

import { AVAILABILITY_OPTIONS } from "@/features/wardrobe/constants";
import type { AvailabilityStatus } from "@/features/wardrobe/types";

export function WardrobeCardControls({
  itemName,
  availability,
  busy,
  onEdit,
  onAvailability,
  onDelete,
}: {
  itemName: string;
  availability: AvailabilityStatus;
  busy: boolean;
  onEdit: () => void;
  onAvailability: (availability: AvailabilityStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div className="wardrobe-card__controls">
      <label>
        <span className="sr-only">Availability for {itemName}</span>
        <select
          aria-label={`Availability for ${itemName}`}
          disabled={busy}
          onChange={(event) => onAvailability(event.target.value as AvailabilityStatus)}
          value={availability}
        >
          {AVAILABILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button aria-label={`Edit ${itemName}`} disabled={busy} onClick={onEdit} type="button">
        <PencilSimple size={14} /> Edit
      </button>
      <button
        aria-label={`Delete ${itemName}`}
        className="danger-link"
        disabled={busy}
        onClick={onDelete}
        type="button"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}
