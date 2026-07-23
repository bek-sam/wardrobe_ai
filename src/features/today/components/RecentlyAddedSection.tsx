import { ArrowRight } from "@phosphor-icons/react";

import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/PageHeader";

import { RecentlyAddedStrip } from "./RecentlyAddedStrip";
import type { TodayItem } from "./today.types";

export function RecentlyAddedSection({
  coreLoading,
  recentItems,
}: {
  coreLoading: boolean;
  recentItems: TodayItem[];
}) {
  return (
    <section>
      <SectionHeader
        title="Recently added"
        description="A quick way back to the pieces you are still getting to know."
        action={
          <ButtonLink href="/wardrobe" variant="ghost">
            View wardrobe <ArrowRight size={15} aria-hidden="true" />
          </ButtonLink>
        }
      />
      {coreLoading ? (
        <div className="recent-strip recent-strip--loading" aria-busy="true" role="status">
          <span>Loading recent wardrobe items…</span>
        </div>
      ) : recentItems.length ? (
        <RecentlyAddedStrip items={recentItems} />
      ) : (
        <div className="recent-strip-empty">
          <p>No owned items have been added yet.</p>
          <ButtonLink href="/wardrobe/import" variant="secondary">
            Add your first piece
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
