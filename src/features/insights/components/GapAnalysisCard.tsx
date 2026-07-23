import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { Sparkle } from "@phosphor-icons/react";

export function GapAnalysisCard({
  heading,
  description,
  action,
}: {
  heading: ReactNode;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <Card as="section" className="gap-card">
      <span className="gap-card__icon">
        <Sparkle size={25} weight="light" />
      </span>
      <div>
        <p className="eyebrow">Conservative gap analysis</p>
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>
      {action}
    </Card>
  );
}
