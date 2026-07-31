"use client";

import { useImageGeometry } from "../hooks/use-image-geometry";
import type { StudioGarmentDetail } from "../types";
import { GarmentHotspotLayer } from "./GarmentHotspotLayer";
import { LayerChooser } from "./LayerChooser";
import { useInteractiveImage } from "./use-interactive-image";

type Props = {
  imageUrl: string;
  garments: readonly StudioGarmentDetail[];
  selectedItemId: string | null;
  onSelect: (itemId: string) => void;
};

/**
 * Clicking is an enhancement, never the only route: the garment chips below
 * the image select the same pieces without any pointer precision, which is
 * what keeps the feature usable when localization is approximate.
 */
export function InteractiveTryOnImage({ imageUrl, garments, selectedItemId, onSelect }: Props) {
  const { containerRef, natural, container, onImageLoad } = useImageGeometry();
  const { hotspots, ambiguous, choose, onPointer, dismissChooser, nameFor } = useInteractiveImage(
    garments,
    natural,
    container,
    onSelect,
  );

  return (
    <div className="tryon__frame" ref={containerRef}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL */}
      <img
        alt="AI style visualization of the selected outfit"
        className="tryon__image"
        onClick={onPointer}
        onLoad={onImageLoad}
        src={imageUrl}
      />
      {natural && container ? (
        <GarmentHotspotLayer
          container={container}
          hotspots={hotspots}
          natural={natural}
          nameFor={nameFor}
          selectedItemId={selectedItemId}
        />
      ) : null}
      {ambiguous ? (
        <LayerChooser
          hotspots={ambiguous}
          nameFor={nameFor}
          onChoose={choose}
          onDismiss={dismissChooser}
        />
      ) : null}
    </div>
  );
}
