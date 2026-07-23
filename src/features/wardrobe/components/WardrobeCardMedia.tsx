import { Heart } from "@phosphor-icons/react";
import Link from "next/link";

import { artworkCategory } from "./artwork-category";
import { GarmentArtwork } from "./GarmentArtwork";
import type { LiveWardrobeItem } from "./wardrobe-manager.types";

export function WardrobeCardMedia({
  item,
  busy,
  onFavorite,
}: {
  item: LiveWardrobeItem;
  busy: boolean;
  onFavorite: () => void;
}) {
  return (
    <>
      <Link
        aria-label={`Open ${item.name}`}
        className="wardrobe-card__image wardrobe-card__image-button"
        href={`/wardrobe/${item.id}`}
      >
        {item.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="wardrobe-card__photo" src={item.primary_image_url} />
        ) : (
          <GarmentArtwork
            category={artworkCategory(item)}
            color={item.primary_color_hex ?? "#9c968b"}
            accent={item.secondary_color_hex ?? undefined}
          />
        )}
      </Link>
      <button
        aria-label={item.favorite ? `Remove ${item.name} from favorites` : `Favorite ${item.name}`}
        aria-pressed={item.favorite}
        className={`wardrobe-card__favorite-button${item.favorite ? " is-active" : ""}`}
        disabled={busy}
        onClick={onFavorite}
        type="button"
      >
        <Heart size={17} weight={item.favorite ? "fill" : "regular"} />
      </button>
    </>
  );
}
