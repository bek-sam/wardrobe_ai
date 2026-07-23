import { Button } from "@/components/ui/Button";
import { PreviewBadge } from "@/components/ui/Badge";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

export function PreviewInsightsHeader() {
  return (
    <>
      <PageHeader
        eyebrow="Wardrobe intelligence"
        title="Insights"
        description="See what earns its place, what gets overlooked, and where your wardrobe has room to improve."
        meta={<PreviewBadge />}
        actions={
          <Button disabled variant="secondary">
            Last 12 months
          </Button>
        }
      />
      <DemoNotice>
        Preview mode: every metric below is illustrative. Configure Supabase to calculate insights
        from your wardrobe and wear history.
      </DemoNotice>
    </>
  );
}
