import { Crop, Sparkle } from "@phosphor-icons/react";

import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

import { titleCase } from "./import-text-helpers";
import type { CandidateView } from "./import-workspace.types";

export function CandidateImage({ candidate }: { candidate: CandidateView }) {
  const url =
    candidate.status === "review_crop" || candidate.status === "extracting"
      ? candidate.cropUrl
      : (candidate.cutoutUrl ?? candidate.cropUrl ?? candidate.failedCutoutUrl);
  return (
    <div className="candidate-card__image candidate-card__image--photo">
      {url ? (
        // Signed private URLs are intentionally rendered without Next's public image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${candidate.metadata.name} review`} src={url} />
      ) : (
        <GarmentArtwork
          category={candidate.metadata.category === "bottoms" ? "bottom" : "top"}
          color={candidate.metadata.primary_color_hex ?? "#a49b8e"}
        />
      )}
      <span>
        {candidate.status === "review_crop" ? <Crop size={14} /> : <Sparkle size={14} />}
        {titleCase(candidate.status)}
      </span>
    </div>
  );
}
