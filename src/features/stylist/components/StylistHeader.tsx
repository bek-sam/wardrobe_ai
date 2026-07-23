import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export function StylistHeader({
  aiAvailable,
  showReset,
  resetDisabled,
  onReset,
}: {
  aiAvailable: boolean;
  showReset: boolean;
  resetDisabled: boolean;
  onReset: () => void;
}) {
  return (
    <PageHeader
      eyebrow="Wardrobe orchestrator"
      title="Your stylist"
      description="Ask naturally. Recommendations use only authenticated, available wardrobe items."
      meta={
        <Badge tone={aiAvailable ? "sage" : "outline"}>
          {aiAvailable ? "Owned items only" : "AI disabled"}
        </Badge>
      }
      actions={
        showReset ? (
          <Button disabled={resetDisabled} onClick={onReset} variant="ghost">
            Start over
          </Button>
        ) : undefined
      }
    />
  );
}
