"use client";

import { Button } from "@/components/ui/Button";

import { ComposerChips } from "./ComposerChips";
import { ComposerContextFields } from "./ComposerContextFields";
import { ComposerRequestField } from "./ComposerRequestField";
import { OCCASION_CHIPS, VIBE_CHIPS } from "./composer-options.data";
import type { ComposerState } from "./use-composer";

type Props = { composer: ComposerState; busy: boolean; onSubmit: (surprise: boolean) => void };

export function OutfitRequestComposer({ composer, busy, onSubmit }: Props) {
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(false);
      }}
    >
      <ComposerRequestField onChange={composer.setMessage} value={composer.message} />
      <ComposerChips
        isSelected={(option) => composer.occasion === option}
        legend="Occasion"
        onToggle={(option) => composer.setOccasion(composer.occasion === option ? null : option)}
        options={OCCASION_CHIPS}
      />
      <ComposerChips
        isSelected={(option) => composer.vibes.includes(option)}
        legend="Vibe"
        onToggle={composer.toggleVibe}
        options={VIBE_CHIPS}
      />
      <ComposerContextFields composer={composer} />

      <div className="composer__actions">
        <Button disabled={busy} type="submit">
          {busy ? "Finding looks…" : "Show me three looks"}
        </Button>
        <Button disabled={busy} onClick={() => onSubmit(true)} variant="ghost">
          Surprise me
        </Button>
      </div>
    </form>
  );
}
