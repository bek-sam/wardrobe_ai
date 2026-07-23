import { PreviewBadge } from "@/components/ui/Badge";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

import { WardrobeHeaderActions } from "./WardrobeHeaderActions";
import { WardrobeItemCard } from "./WardrobeItemCard";
import type { WardrobePreviewItem } from "./wardrobe-item-card.types";
import { WardrobeToolbar } from "./WardrobeToolbar";

export function PreviewWardrobe({ items }: { items: WardrobePreviewItem[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe"
        description="Search, filter, and understand every piece you own."
        meta={<PreviewBadge />}
        actions={<WardrobeHeaderActions />}
      />
      <DemoNotice>
        These garments are labeled samples because Supabase is not configured. Connect Supabase to
        load and manage your private wardrobe.
      </DemoNotice>
      <WardrobeToolbar
        activeFilterCount={0}
        disabled
        filtersOpen={false}
        onSearch={() => {}}
        onToggleFilters={() => {}}
        onViewMode={() => {}}
        search=""
        viewMode="grid"
      />
      <div className="wardrobe-results">
        <p>{items.length} sample pieces</p>
      </div>
      <section className="wardrobe-grid" aria-label="Sample wardrobe items">
        {items.map((item) => (
          <WardrobeItemCard item={item} key={item.id} sample />
        ))}
      </section>
    </>
  );
}
