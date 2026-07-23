import type { OutfitRecord } from "./outfits-manager.types";

export function appendWearLog(outfits: OutfitRecord[], outfitId: string): OutfitRecord[] {
  return outfits.map((candidate) =>
    candidate.id === outfitId
      ? {
          ...candidate,
          wear_logs: [
            { id: crypto.randomUUID(), worn_at: new Date().toISOString() },
            ...(candidate.wear_logs ?? []),
          ],
        }
      : candidate,
  );
}
