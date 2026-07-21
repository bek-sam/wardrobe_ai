import { ArrowRight, Heart } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  GarmentArtwork,
  type GarmentCategory,
} from "@/features/wardrobe/components/GarmentArtwork";

interface OutfitPiece {
  category: GarmentCategory;
  color: string;
  accent?: string;
}

export interface OutfitPreview {
  id: string;
  name: string;
  occasion: string;
  detail: string;
  pieces: OutfitPiece[];
  favorite?: boolean;
}

export function OutfitCard({
  outfit,
  sample = false,
  actions,
}: {
  outfit: OutfitPreview;
  sample?: boolean;
  actions?: ReactNode;
}) {
  return (
    <article className="outfit-card">
      <div className="outfit-card__canvas">
        <div className="outfit-card__pieces">
          {outfit.pieces.map((piece, index) => (
            <GarmentArtwork compact key={`${piece.category}-${index}`} {...piece} />
          ))}
        </div>
        {sample ? <Badge tone="outline">Sample look</Badge> : null}
        {outfit.favorite ? (
          <Heart
            className="outfit-card__heart"
            size={19}
            weight="fill"
            aria-label="Favorite outfit"
          />
        ) : null}
      </div>
      <div className="outfit-card__body">
        <p className="eyebrow">{outfit.occasion}</p>
        <h3>{outfit.name}</h3>
        <p>{outfit.detail}</p>
        {actions ? (
          <div className="outfit-card__actions">{actions}</div>
        ) : (
          <Link href={`/outfits?look=${outfit.id}`}>
            View look <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </article>
  );
}
