import { ItemAvailabilitySelect } from "./ItemAvailabilitySelect";
import type { ItemDetail } from "./item-detail.types";

export function ItemFactsList({
  item,
  setItem,
  action,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
}) {
  return (
    <dl className="item-facts">
      <div>
        <dt>Colors</dt>
        <dd>{item.color_names.join(" · ") || "Not recorded"}</dd>
      </div>
      <div>
        <dt>Material</dt>
        <dd>
          {Object.keys(item.materials).length ? JSON.stringify(item.materials) : "Not recorded"}
        </dd>
      </div>
      <div>
        <dt>Fit</dt>
        <dd>{item.fit ?? "Not recorded"}</dd>
      </div>
      <div>
        <dt>Formality</dt>
        <dd>{item.formality_level ? `${item.formality_level} / 5` : "Not recorded"}</dd>
      </div>
      <div>
        <dt>Season</dt>
        <dd>{item.season_tags.join(" · ") || "Not recorded"}</dd>
      </div>
      <div>
        <dt>Availability</dt>
        <dd>
          <ItemAvailabilitySelect action={action} item={item} setItem={setItem} />
        </dd>
      </div>
    </dl>
  );
}
