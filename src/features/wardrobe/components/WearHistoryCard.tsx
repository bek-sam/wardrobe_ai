import { Check } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requestJson } from "@/lib/api/request";

import type { ItemDetail } from "./item-detail.types";

export function WearHistoryCard({
  item,
  costPerWear,
  busy,
  action,
  reload,
}: {
  item: ItemDetail;
  costPerWear: string | null;
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  return (
    <Card as="section" className="wear-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Wear history</p>
          <h2>{item.wear_count} wears</h2>
        </div>
        {costPerWear ? <Badge tone="sage">{costPerWear} / wear</Badge> : null}
      </div>
      <p>
        {item.last_worn_at
          ? `Last worn ${new Date(item.last_worn_at).toLocaleDateString()}`
          : "No wear logged yet"}
      </p>
      <Button
        disabled={busy === "wear"}
        onClick={() =>
          void action("wear", async () => {
            await requestJson(`/api/items/${item.id}/mark-worn`, { method: "POST", body: "{}" });
            await reload();
          })
        }
      >
        <Check size={16} /> Mark worn today
      </Button>
    </Card>
  );
}
