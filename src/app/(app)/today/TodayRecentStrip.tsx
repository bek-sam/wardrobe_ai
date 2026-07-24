import { ArrowRight } from "@phosphor-icons/react/ssr";

import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/PageHeader";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

import { previewItems } from "../preview-data";

export function TodayRecentStrip() {
  return (
    <section>
      <SectionHeader
        title="Recently added"
        description="A quick way back to the pieces you are still getting to know."
        action={
          <ButtonLink href="/wardrobe" variant="ghost">
            View wardrobe <ArrowRight size={15} />
          </ButtonLink>
        }
      />
      <div className="recent-strip">
        {previewItems.slice(0, 4).map((item) => (
          <article key={item.id}>
            <GarmentArtwork
              compact
              category={item.category}
              color={item.color}
              accent={item.accent}
            />
            <div>
              <span>{item.categoryLabel}</span>
              <strong>{item.name}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
