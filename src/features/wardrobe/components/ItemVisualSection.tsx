import { Badge } from "@/components/ui/Badge";

import type { ItemDetail } from "./item-detail.types";

export function ItemVisualSection({ item }: { item: ItemDetail }) {
  return (
    <section className="item-detail__visual" aria-label={`${item.name} private images`}>
      <div className="item-detail__art">
        {item.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={item.name} src={item.primary_image_url} />
        ) : (
          <div className="item-detail__image-empty">No image yet</div>
        )}
        <Badge tone="outline">Private image</Badge>
      </div>
      {item.images.length > 1 ? (
        <div className="item-detail__thumbs">
          {item.images.map((image) => (
            <a href={image.signed_url} key={image.id} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`${item.name} ${image.kind}`} src={image.signed_url} />
              <span>{image.kind}</span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
