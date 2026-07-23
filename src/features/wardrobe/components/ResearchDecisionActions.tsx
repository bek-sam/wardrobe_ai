import { Check } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { requestJson } from "@/lib/api/request";

import type { ResearchRun } from "./item-detail.types";

export function ResearchDecisionActions({
  itemId,
  run,
  researchFields,
  busy,
  action,
  onDecided,
}: {
  itemId: string;
  run: ResearchRun;
  researchFields: string[];
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDecided: () => Promise<void>;
}) {
  if (!["verified", "likely", "uncertain"].includes(run.status)) return null;
  return (
    <div className="item-detail__actions">
      <Button
        disabled={!researchFields.length || busy === "accept-research"}
        onClick={() =>
          void action("accept-research", async () => {
            await requestJson(`/api/items/${itemId}/research/${run.id}/accept`, {
              method: "POST",
              body: JSON.stringify({ fields: researchFields }),
            });
            await onDecided();
          })
        }
      >
        <Check size={15} /> Accept supported fields
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          void action("reject-research", async () => {
            await requestJson(`/api/items/${itemId}/research/${run.id}/reject`, { method: "POST" });
            await onDecided();
          })
        }
      >
        Reject proposal
      </Button>
    </div>
  );
}
