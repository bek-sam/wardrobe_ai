import { useState } from "react";

import { useItemDetailActions } from "./use-item-detail-actions";
import { useItemDetailData } from "./use-item-detail-data";

export function useItemDetail(itemId: string) {
  const data = useItemDetailData(itemId);
  const { busy, action } = useItemDetailActions(data.setError);
  const [researchClue, setResearchClue] = useState("");
  const [editing, setEditing] = useState(false);

  const costPerWear =
    data.item && data.item.purchase_price !== null && data.item.wear_count > 0
      ? `${data.item.currency ?? ""} ${(data.item.purchase_price / data.item.wear_count).toFixed(2)}`.trim()
      : null;

  return { ...data, busy, action, researchClue, setResearchClue, editing, setEditing, costPerWear };
}
