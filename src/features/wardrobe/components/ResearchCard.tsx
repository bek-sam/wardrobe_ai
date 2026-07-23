import { Card } from "@/components/ui/Card";

import { ResearchCardDescription, ResearchCardHeader } from "./ResearchCardHeader";
import { ResearchClueForm } from "./ResearchClueForm";
import { ResearchDecisionActions } from "./ResearchDecisionActions";
import { ResearchSourcesList } from "./ResearchSourcesList";
import type { ResearchCardProps } from "./item-detail.types";

export function ResearchCard({
  itemId,
  latestResearch,
  researchFields,
  researchClue,
  setResearchClue,
  busy,
  action,
  reload,
}: ResearchCardProps) {
  return (
    <Card as="section" className="research-card" id="item-research">
      <ResearchCardHeader latestResearch={latestResearch} />
      <ResearchCardDescription />
      <ResearchClueForm
        action={action}
        busy={busy}
        itemId={itemId}
        reload={reload}
        researchClue={researchClue}
        setResearchClue={setResearchClue}
      />
      <ResearchSourcesList sources={latestResearch?.research_sources ?? []} />
      {latestResearch ? (
        <ResearchDecisionActions
          action={action}
          busy={busy}
          itemId={itemId}
          onDecided={reload}
          researchFields={researchFields}
          run={latestResearch}
        />
      ) : null}
    </Card>
  );
}
