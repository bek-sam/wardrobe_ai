import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { DemoNotice } from "@/components/ui/DemoNotice";
import { WardrobeItemDetail } from "@/features/wardrobe/components/WardrobeItemDetail";
import { isSupabaseConfigured } from "@/lib/env/client";

import { previewItems } from "../../preview-data";
import { PreviewDangerZone } from "./PreviewDangerZone";
import { PreviewItemInfo } from "./PreviewItemInfo";
import { PreviewItemVisual } from "./PreviewItemVisual";
import { PreviewOutfitHistoryCard } from "./PreviewOutfitHistoryCard";
import { PreviewResearchCard } from "./PreviewResearchCard";
import { PreviewWearCard } from "./PreviewWearCard";

export const metadata = { title: "Wardrobe item" };

export default async function WardrobeItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (isSupabaseConfigured()) return <WardrobeItemDetail itemId={itemId} />;
  const item = previewItems.find((candidate) => candidate.id === itemId) ?? previewItems[0];
  if (!item) return null;

  return (
    <div className="item-page">
      <Link className="back-link" href="/wardrobe">
        <ArrowLeft size={15} /> Back to wardrobe
      </Link>
      <DemoNotice>
        This is a sample item detail view for <strong>{itemId}</strong>. Changes and actions are not
        persisted.
      </DemoNotice>
      <div className="item-detail">
        <PreviewItemVisual item={item} />
        <PreviewItemInfo item={item} />
      </div>

      <div className="item-lower-grid">
        <PreviewResearchCard />
        <PreviewWearCard />
      </div>

      <PreviewOutfitHistoryCard />
      <PreviewDangerZone />
    </div>
  );
}
