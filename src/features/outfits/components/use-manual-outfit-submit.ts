import { useState } from "react";
import type { FormEvent } from "react";

import { requestJson } from "@/lib/api/request";

import { buildManualOutfitPayload } from "./build-manual-outfit-payload";
import type { OutfitRecord, OutfitSelections } from "./outfits-manager.types";

export function useManualOutfitSubmit(
  onSaved: (outfit: OutfitRecord) => void,
  selectedEntries: Array<{ role: keyof OutfitSelections; item: { id: string } }>,
) {
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [explanation, setExplanation] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, validationMessage: string | null) {
    event.preventDefault();
    if (validationMessage || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await requestJson<OutfitRecord>("/api/outfits", {
        method: "POST",
        body: JSON.stringify(
          buildManualOutfitPayload({ name, occasion, explanation, favorite, selectedEntries }),
        ),
      });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit could not be saved.");
      setSaving(false);
    }
  }

  return {
    name,
    setName,
    occasion,
    setOccasion,
    explanation,
    setExplanation,
    favorite,
    setFavorite,
    saving,
    error,
    submit,
  };
}
