import Link from "next/link";

import type { AvailabilityStatus } from "@/features/wardrobe/types";

import { WardrobeCardControls } from "./WardrobeCardControls";
import { WardrobeCardMedia } from "./WardrobeCardMedia";
import { titleCase } from "./wardrobe-manager.helpers";
import type { LiveWardrobeItem } from "./wardrobe-manager.types";

export function LiveWardrobeCard({
  item,
  busy,
  onEdit,
  onFavorite,
  onAvailability,
  onDelete,
}: {
  item: LiveWardrobeItem;
  busy: boolean;
  onEdit: () => void;
  onFavorite: () => void;
  onAvailability: (availability: AvailabilityStatus) => void;
  onDelete: () => void;
}) {
  const meta = [item.brand, item.color_names.join(" · ")].filter(Boolean).join(" · ");
  return (
    <article className="wardrobe-card wardrobe-card--live">
      <WardrobeCardMedia busy={busy} item={item} onFavorite={onFavorite} />
      <div className="wardrobe-card__body">
        <div>
          <p>{titleCase(item.category)}</p>
          <h3>
            <Link href={`/wardrobe/${item.id}`}>{item.name}</Link>
          </h3>
        </div>
        <span className="wardrobe-card__meta">{meta || "No brand or color details yet"}</span>
        <WardrobeCardControls
          availability={item.availability_status}
          busy={busy}
          itemName={item.name}
          onAvailability={onAvailability}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      </div>
    </article>
  );
}
