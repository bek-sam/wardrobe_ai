import { LinkSimple } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { Card } from "@/components/ui/Card";

export function PreviewOutfitHistoryCard() {
  return (
    <Card as="section" className="item-history">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Outfit history</p>
          <h2>Looks with this piece</h2>
        </div>
        <Link href="/outfits">View all</Link>
      </div>
      <div className="item-history__empty">
        <LinkSimple size={25} weight="light" />
        <div>
          <strong>No saved outfit history yet</strong>
          <p>Once this piece appears in a saved or worn look, it will show here.</p>
        </div>
      </div>
    </Card>
  );
}
