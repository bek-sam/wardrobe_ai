import Link from "next/link";

import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

import { ItemVisual } from "./ItemVisual";
import { readableToken } from "./today-text";
import type { TodayItem } from "./today.types";

export function RecentlyAddedStrip({ items }: { items: TodayItem[] }) {
  return (
    <div className="recent-strip recent-strip--live">
      {items.map((item) => {
        const role = resolveWardrobeItemRole({
          layer_role: item.layerRole,
          category: item.category,
          subcategory: item.subcategory,
        });
        return (
          <article key={item.id}>
            <Link href={`/wardrobe/${item.id}`}>
              <span className="recent-strip__visual">
                <ItemVisual compact item={item} role={role} />
              </span>
              <span className="recent-strip__copy">
                <span>
                  {item.subcategory ?? item.category} · {readableToken(item.availability)}
                </span>
                <strong>{item.name}</strong>
              </span>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
