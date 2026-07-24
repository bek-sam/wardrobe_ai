import { ShirtFolded } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/Badge";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import type { WardrobePreviewItem } from "@/features/wardrobe/components/wardrobe-item-card.types";

export function PreviewItemVisual({ item }: { item: WardrobePreviewItem }) {
  return (
    <section className="item-detail__visual" aria-label={`${item.name} sample artwork`}>
      <div className="item-detail__art">
        <GarmentArtwork category={item.category} color={item.color} accent={item.accent} />
        <Badge tone="outline">Sample cutout</Badge>
      </div>
      <div className="item-detail__thumbs">
        <button className="is-active" type="button">
          <GarmentArtwork compact category={item.category} color={item.color} />
          <span>Cutout</span>
        </button>
        <button type="button">
          <ShirtFolded size={25} />
          <span>Original</span>
        </button>
      </div>
    </section>
  );
}
