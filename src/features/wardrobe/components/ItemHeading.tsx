import { Heart } from "@phosphor-icons/react";

import { requestJson } from "@/lib/api/request";

import type { ItemDetail } from "./item-detail.types";

export function ItemHeading({
  item,
  setItem,
  action,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
}) {
  return (
    <div className="item-detail__heading">
      <div>
        <p className="eyebrow">{item.category}</p>
        <h1>{item.name}</h1>
        <p>{item.brand ?? "Brand not confirmed"}</p>
      </div>
      <button
        aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={item.favorite}
        className="favorite-button"
        onClick={() =>
          void action("favorite", async () => {
            const result = await requestJson<{ favorite: boolean }>(
              `/api/items/${item.id}/favorite`,
              {
                method: "POST",
                body: JSON.stringify({ favorite: !item.favorite }),
              },
            );
            setItem((current) => (current ? { ...current, favorite: result.favorite } : current));
          })
        }
        type="button"
      >
        <Heart size={21} weight={item.favorite ? "fill" : "regular"} />
      </button>
    </div>
  );
}
