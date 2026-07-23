import { PreviewBadge } from "@/components/ui/Badge";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

import { PreviewChatPanel } from "./PreviewChatPanel";
import { PreviewRecommendationPanel } from "./PreviewRecommendationPanel";

export function PreviewStylist() {
  return (
    <>
      <PageHeader
        eyebrow="Wardrobe orchestrator"
        title="Your stylist"
        description="Ask naturally. Recommendations use only pieces saved in your wardrobe."
        meta={<PreviewBadge />}
      />
      <DemoNotice>
        This conversation and look are explicitly labeled samples because Supabase is not
        configured. No message is sent and no owned items are inferred.
      </DemoNotice>
      <div className="stylist-layout">
        <PreviewChatPanel />
        <PreviewRecommendationPanel />
      </div>
    </>
  );
}
