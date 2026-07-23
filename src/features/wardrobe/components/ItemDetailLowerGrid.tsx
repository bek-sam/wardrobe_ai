import { ResearchCard } from "./ResearchCard";
import { WearHistoryCard } from "./WearHistoryCard";
import type { ItemDetail } from "./item-detail.types";
import type { useItemDetail } from "./use-item-detail";

export function ItemDetailLowerGrid({
  item,
  state,
}: {
  item: ItemDetail;
  state: ReturnType<typeof useItemDetail>;
}) {
  return (
    <div className="item-lower-grid">
      <ResearchCard
        action={state.action}
        busy={state.busy}
        itemId={item.id}
        latestResearch={state.latestResearch}
        reload={state.load}
        researchClue={state.researchClue}
        researchFields={state.researchFields}
        setResearchClue={state.setResearchClue}
      />
      <WearHistoryCard
        action={state.action}
        busy={state.busy}
        costPerWear={state.costPerWear}
        item={item}
        reload={state.load}
      />
    </div>
  );
}
