import { useState } from "react";

export function useOutfitFeedbackState() {
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [planned, setPlanned] = useState(false);
  return {
    savedOutfitId,
    setSavedOutfitId,
    saving,
    setSaving,
    feedback,
    setFeedback,
    feedbackBusy,
    setFeedbackBusy,
    planned,
    setPlanned,
  };
}
