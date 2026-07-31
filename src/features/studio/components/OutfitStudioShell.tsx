"use client";

import { useStudio } from "../hooks/use-studio";
import { useComposer } from "./use-composer";
import { OutfitRequestComposer } from "./OutfitRequestComposer";
import { RecommendationVariantTabs } from "./RecommendationVariantTabs";
import { StudioDetailRail } from "./StudioDetailRail";
import { StudioNotices } from "./StudioNotices";
import { StudioStage } from "./StudioStage";
import { StudioActions } from "./StudioActions";

/**
 * The single Outfit Studio experience, reached from outfit generation and
 * reusable for a saved, manual, or planned outfit. Twelve-column on desktop,
 * image-first with a sticky action dock on mobile — laid out in CSS so this
 * component stays one tree rather than two divergent renders.
 */
export function OutfitStudioShell({ initialDate }: { initialDate: string }) {
  const composer = useComposer(initialDate);
  const studio = useStudio(composer.occasion, composer.buildInput);

  return (
    <div className="studio">
      <aside className="studio__rail studio__rail--controls">
        <OutfitRequestComposer
          busy={studio.variants.busy}
          composer={composer}
          onSubmit={(surprise) => void studio.request(composer.buildInput(surprise))}
        />
        <RecommendationVariantTabs
          mode={studio.variants.mode}
          onSelect={studio.variants.setMode}
          variants={studio.variants.variants}
        />
      </aside>

      {/* A section, not a <main>: AppShell already owns the page's single
          main landmark, and nesting a second one is invalid. */}
      <section aria-label="Selected look" className="studio__main">
        <StudioNotices studio={studio} />
        <StudioStage studio={studio} />
        <StudioActions composerDate={composer.date} studio={studio} />
      </section>

      <aside className="studio__rail studio__rail--detail">
        <StudioDetailRail studio={studio} />
      </aside>
    </div>
  );
}
