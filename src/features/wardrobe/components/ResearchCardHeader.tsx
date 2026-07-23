import { Badge } from "@/components/ui/Badge";

import type { ResearchRun } from "./item-detail.types";

export function ResearchCardHeader({ latestResearch }: { latestResearch: ResearchRun | null }) {
  return (
    <div className="card-title-row">
      <div>
        <p className="eyebrow">Product research</p>
        <h2>{latestResearch?.summary || "Identity not researched"}</h2>
      </div>
      <Badge tone={latestResearch?.status === "verified" ? "sage" : "neutral"}>
        {latestResearch?.status ?? "Not started"}
      </Badge>
    </div>
  );
}

export function ResearchCardDescription() {
  return (
    <p>
      Research uses confirmed labels, SKU/barcode, brand clues, and source evidence. Similar
      appearance alone is never proof.
    </p>
  );
}
