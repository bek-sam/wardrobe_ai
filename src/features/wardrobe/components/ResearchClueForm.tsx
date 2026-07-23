import { MagicWand, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import { startResearch } from "./start-research";

export function ResearchClueForm({
  itemId,
  researchClue,
  setResearchClue,
  busy,
  action,
  reload,
}: {
  itemId: string;
  researchClue: string;
  setResearchClue: (value: string) => void;
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  return (
    <>
      <label className="form-field">
        <span>Optional clue</span>
        <input
          value={researchClue}
          onChange={(event) => setResearchClue(event.target.value)}
          placeholder="Label text, SKU, model, or product clue"
        />
      </label>
      <Button
        disabled={busy === "research"}
        onClick={() => void action("research", () => startResearch(itemId, researchClue, reload))}
        variant="secondary"
      >
        {busy === "research" ? <SpinnerGap className="spin" size={16} /> : <MagicWand size={16} />}{" "}
        Start source-backed research
      </Button>
    </>
  );
}
