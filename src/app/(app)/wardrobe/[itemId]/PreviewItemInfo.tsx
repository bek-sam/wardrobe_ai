import { Heart, MagicWand, PencilSimple } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/Button";
import type { WardrobePreviewItem } from "@/features/wardrobe/components/wardrobe-item-card.types";

import { PreviewItemFacts } from "./PreviewItemFacts";

export function PreviewItemInfo({ item }: { item: WardrobePreviewItem }) {
  return (
    <section className="item-detail__content">
      <div className="item-detail__heading">
        <div>
          <p className="eyebrow">{item.categoryLabel}</p>
          <h1>{item.name}</h1>
          <p>Brand not confirmed</p>
        </div>
        <button className="favorite-button" type="button" aria-label="Add to favorites">
          <Heart size={21} />
        </button>
      </div>
      <div className="item-detail__actions">
        <Button>
          <PencilSimple size={16} /> Edit details
        </Button>
        <Button variant="secondary">
          <MagicWand size={16} /> Research item
        </Button>
      </div>
      <PreviewItemFacts item={item} />
      <div className="tag-list" aria-label="Item tags">
        <span>office</span>
        <span>smart casual</span>
        <span>breathable</span>
        <span>layerable</span>
      </div>
    </section>
  );
}
