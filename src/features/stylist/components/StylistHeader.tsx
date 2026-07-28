import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

import { hasGenerationCapability, type StylistCapabilities } from "../capabilities";

export function StylistHeader({
  capabilities,
  showReset,
  resetDisabled,
  onReset,
}: {
  capabilities: StylistCapabilities;
  showReset: boolean;
  resetDisabled: boolean;
  onReset: () => void;
}) {
  const label = !capabilities.chatAvailable
    ? "Sign in required"
    : hasGenerationCapability(capabilities)
      ? "Owned items only"
      : "Lookups & insights only";
  return (
    <PageHeader
      eyebrow="Wardrobe orchestrator"
      title="Your stylist"
      description="Ask naturally. Recommendations use only authenticated, available wardrobe items."
      meta={<Badge tone={capabilities.chatAvailable ? "sage" : "outline"}>{label}</Badge>}
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
