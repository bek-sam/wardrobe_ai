import { Badge } from "@/components/ui/Badge";
import type { WardrobePreviewItem } from "@/features/wardrobe/components/wardrobe-item-card.types";

export function PreviewItemFacts({ item }: { item: WardrobePreviewItem }) {
  return (
    <dl className="item-facts">
      <div>
        <dt>Primary color</dt>
        <dd>
          <span className="color-dot" style={{ backgroundColor: item.color }} /> Warm stone
        </dd>
      </div>
      <div>
        <dt>Material</dt>
        <dd>
          Cotton <Badge tone="gold">AI inferred</Badge>
        </dd>
      </div>
      <div>
        <dt>Fit</dt>
        <dd>Relaxed</dd>
      </div>
      <div>
        <dt>Formality</dt>
        <dd>3 / 5 · Smart casual</dd>
      </div>
      <div>
        <dt>Season</dt>
        <dd>Spring · Summer · Fall</dd>
      </div>
      <div>
        <dt>Availability</dt>
        <dd>
          <span className="availability-dot" /> Available
        </dd>
      </div>
    </dl>
  );
}
