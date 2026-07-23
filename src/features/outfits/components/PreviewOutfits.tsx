import { PageHeader } from "@/components/ui/PageHeader";
import { PreviewBadge } from "@/components/ui/Badge";
import { DemoNotice } from "@/components/ui/DemoNotice";

import { OutfitCard } from "./OutfitCard";
import { OutfitsHeaderActions } from "./OutfitsHeaderActions";
import type { OutfitPreview } from "./outfit-card.types";
import { PreviewOutfitsEmptyPrompt } from "./PreviewOutfitsEmptyPrompt";
import { PreviewOutfitsToolbar } from "./PreviewOutfitsToolbar";
import { PreviewOutfitTabs } from "./PreviewOutfitTabs";

export function PreviewOutfits({ outfits }: { outfits: OutfitPreview[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Saved combinations"
        title="Outfits"
        description="Keep the looks that work, revisit favorites, and learn from what you actually wear."
        meta={<PreviewBadge />}
        actions={<OutfitsHeaderActions />}
      />
      <DemoNotice>
        Preview mode: these looks are labeled samples. Configure Supabase to load and manage your
        saved outfits.
      </DemoNotice>
      <PreviewOutfitTabs total={outfits.length} />
      <PreviewOutfitsToolbar />
      <section className="outfit-grid" aria-label="Sample saved outfits">
        {outfits.map((outfit) => (
          <OutfitCard key={outfit.id} outfit={outfit} sample />
        ))}
      </section>
      <PreviewOutfitsEmptyPrompt />
    </>
  );
}
