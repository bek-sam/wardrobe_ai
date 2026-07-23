import { Plus, Sparkle } from "@phosphor-icons/react";

import { Button, ButtonLink } from "@/components/ui/Button";

export function OutfitsHeaderActions({ onBuildManually }: { onBuildManually?: () => void }) {
  return (
    <>
      <Button disabled={!onBuildManually} onClick={onBuildManually} variant="secondary">
        <Plus size={16} /> Build manually
      </Button>
      {onBuildManually ? (
        <ButtonLink href="/stylist">
          <Sparkle size={16} /> Generate outfits
        </ButtonLink>
      ) : (
        <Button disabled>
          <Sparkle size={16} /> Generate outfits
        </Button>
      )}
    </>
  );
}
