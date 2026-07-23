import { Plus, UploadSimple } from "@phosphor-icons/react";

import { Button, ButtonLink } from "@/components/ui/Button";

export function WardrobeHeaderActions({ onAddManually }: { onAddManually?: () => void }) {
  return (
    <>
      <ButtonLink href="/wardrobe/import">
        <UploadSimple size={16} /> Add by photo
      </ButtonLink>
      <Button disabled={!onAddManually} onClick={onAddManually} variant="secondary">
        <Plus size={16} /> Add manually
      </Button>
    </>
  );
}
