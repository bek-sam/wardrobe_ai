import { SpinnerGap } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

export function ImportLoadingCard() {
  return (
    <Card className="import-loading" role="status">
      <SpinnerGap className="spin" size={21} /> Checking for an unfinished import…
    </Card>
  );
}
