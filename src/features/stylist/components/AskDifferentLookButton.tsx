import { Shuffle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function AskDifferentLookButton({
  occasion,
  onSetMessage,
}: {
  occasion: string;
  onSetMessage: (message: string) => void;
}) {
  return (
    <Button
      fullWidth
      onClick={() =>
        onSetMessage(`Build a different look for ${occasion.trim() || "this occasion"}.`)
      }
      variant="ghost"
    >
      <Shuffle size={16} /> Ask for a different look
    </Button>
  );
}
