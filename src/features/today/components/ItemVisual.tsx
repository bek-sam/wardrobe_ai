import Image from "next/image";

import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import type { OutfitItemRole } from "@/features/outfits/types";

import { artworkCategory } from "./artwork-category";
import type { TodayItem } from "./today.types";

export function ItemVisual({
  item,
  role,
  compact = false,
}: {
  item: TodayItem;
  role: OutfitItemRole | null;
  compact?: boolean;
}) {
  if (item.primaryImageUrl) {
    return (
      <Image
        alt={item.name}
        className="today-item-photo"
        height={640}
        sizes={compact ? "78px" : "(max-width: 600px) 40vw, 180px"}
        src={item.primaryImageUrl}
        unoptimized
        width={480}
      />
    );
  }
  if (!role) {
    return (
      <span className="today-item-fallback" aria-hidden="true">
        {item.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <GarmentArtwork
      compact={compact}
      category={artworkCategory(role)}
      color={item.primaryColor ?? "#827c73"}
      accent={item.secondaryColor ?? undefined}
    />
  );
}
