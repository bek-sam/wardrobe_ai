"use client";

import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ItemDangerZone } from "./ItemDangerZone";
import { ItemDetailContent } from "./ItemDetailContent";
import { ItemDetailLoading } from "./ItemDetailLoading";
import { ItemDetailLowerGrid } from "./ItemDetailLowerGrid";
import { ItemDetailNotFound } from "./ItemDetailNotFound";
import { ItemVisualSection } from "./ItemVisualSection";
import { useItemDetail } from "./use-item-detail";

export function WardrobeItemDetail({ itemId }: { itemId: string }) {
  const router = useRouter();
  const state = useItemDetail(itemId);

  if (state.loading) return <ItemDetailLoading />;
  if (!state.item)
    return <ItemDetailNotFound error={state.error} onRetry={() => void state.load()} />;

  return (
    <div className="item-page">
      <Link className="back-link" href="/wardrobe">
        <ArrowLeft size={15} /> Back to wardrobe
      </Link>
      {state.error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {state.error}
        </div>
      ) : null}
      <div className="item-detail">
        <ItemVisualSection item={state.item} />
        <ItemDetailContent item={state.item} state={state} />
      </div>
      <ItemDetailLowerGrid item={state.item} state={state} />
      <ItemDangerZone
        action={state.action}
        itemId={state.item.id}
        itemName={state.item.name}
        onDone={() => router.push("/wardrobe")}
      />
    </div>
  );
}
