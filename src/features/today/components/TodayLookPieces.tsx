import Link from "next/link";

import { ItemVisual } from "./ItemVisual";
import { readableToken } from "./today-text";
import type { TodayRecommendation } from "./today.types";

export function TodayLookPieces({ recommendation }: { recommendation: TodayRecommendation }) {
  return (
    <div className="today-look__pieces today-look__pieces--live">
      {recommendation.items.map((selection) => {
        const item = recommendation.itemDetails[selection.item_id];
        if (!item) return null;
        return (
          <Link
            className="today-look__piece"
            href={`/wardrobe/${selection.item_id}`}
            key={selection.item_id}
          >
            <span className="today-look__piece-visual">
              <ItemVisual item={item} role={selection.role} />
            </span>
            <span className="today-look__piece-copy">
              <span>{readableToken(selection.role)}</span>
              <strong>{item.name}</strong>
              <small>
                {[item.brand, item.subcategory ?? item.category].filter(Boolean).join(" · ")}
              </small>
              <code>{selection.item_id}</code>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
