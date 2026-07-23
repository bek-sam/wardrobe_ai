import { ItemDetailActionBar } from "./ItemDetailActionBar";
import { ItemEditForm } from "./ItemEditForm";
import { ItemFactsList } from "./ItemFactsList";
import { ItemHeading } from "./ItemHeading";
import type { ItemDetail } from "./item-detail.types";
import type { useItemDetail } from "./use-item-detail";

export function ItemDetailContent({
  item,
  state,
}: {
  item: ItemDetail;
  state: ReturnType<typeof useItemDetail>;
}) {
  return (
    <section className="item-detail__content">
      <ItemHeading action={state.action} item={item} setItem={state.setItem} />
      <ItemDetailActionBar onToggleEdit={() => state.setEditing((value) => !value)} />
      {state.editing ? (
        <ItemEditForm
          action={state.action}
          busy={state.busy}
          editValues={state.editValues}
          item={item}
          onSaved={() => state.setEditing(false)}
          setEditValues={state.setEditValues}
          setItem={state.setItem}
        />
      ) : null}
      <ItemFactsList action={state.action} item={item} setItem={state.setItem} />
    </section>
  );
}
