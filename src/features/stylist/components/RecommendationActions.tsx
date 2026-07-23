import { CalendarBlank, Heart, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function RecommendationActions({
  saving,
  savedOutfitId,
  generationId,
  planned,
  date,
  onSave,
  onPlan,
}: {
  saving: boolean;
  savedOutfitId: string | null;
  generationId: string | null;
  planned: boolean;
  date: string;
  onSave: () => void;
  onPlan: () => void;
}) {
  return (
    <div className="recommendation-actions">
      <Button
        disabled={saving || Boolean(savedOutfitId) || !generationId}
        fullWidth
        onClick={onSave}
      >
        {saving ? <SpinnerGap className="spin" size={16} /> : <Heart size={16} />}
        {savedOutfitId ? "Outfit saved" : generationId ? "Save outfit" : "Read-only look"}
      </Button>
      <Button
        disabled={!savedOutfitId || planned || saving}
        fullWidth
        onClick={onPlan}
        variant="secondary"
      >
        <CalendarBlank size={16} /> {planned ? "Planned" : `Plan for ${date}`}
      </Button>
    </div>
  );
}
