import { Heart, WarningCircle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { GarmentArtwork, type GarmentCategory } from "./GarmentArtwork";

export interface WardrobePreviewItem {
  id: string;
  name: string;
  category: GarmentCategory;
  categoryLabel: string;
  color: string;
  accent?: string;
  meta: string;
  status?: "available" | "laundry";
  favorite?: boolean;
}

export function WardrobeItemCard({
  item,
  sample = false,
}: {
  item: WardrobePreviewItem;
  sample?: boolean;
}) {
  return (
    <article className="wardrobe-card">
      <Link
        className="wardrobe-card__image"
        href={`/wardrobe/${item.id}`}
        aria-label={`Open ${item.name}`}
      >
        <GarmentArtwork category={item.category} color={item.color} accent={item.accent} />
        {sample ? <Badge tone="outline">Sample</Badge> : null}
        {item.favorite ? (
          <Heart
            className="wardrobe-card__favorite"
            weight="fill"
            size={18}
            aria-label="Favorite"
          />
        ) : null}
      </Link>
      <div className="wardrobe-card__body">
        <div>
          <p>{item.categoryLabel}</p>
          <h3>
            <Link href={`/wardrobe/${item.id}`}>{item.name}</Link>
          </h3>
        </div>
        <span className="wardrobe-card__meta">{item.meta}</span>
        {item.status === "laundry" ? (
          <span className="wardrobe-card__status">
            <WarningCircle size={14} /> In laundry
          </span>
        ) : null}
      </div>
    </article>
  );
}
