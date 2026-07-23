import { PlanEditorDateTimeFields } from "./PlanEditorDateTimeFields";
import { PlanEditorLocationStatusFields } from "./PlanEditorLocationStatusFields";
import { PlanEditorOccasionFields } from "./PlanEditorOccasionFields";
import { PlanEditorOutfitField } from "./PlanEditorOutfitField";
import type { OutfitOption, PlanFormState, PlanView } from "./planner.types";

export function PlanEditorFields({
  form,
  setField,
  outfits,
  plan,
}: {
  form: PlanFormState;
  setField: <Key extends keyof PlanFormState>(key: Key, value: PlanFormState[Key]) => void;
  outfits: OutfitOption[];
  plan: PlanView | null;
}) {
  return (
    <>
      <PlanEditorDateTimeFields
        onPlannedDate={(value) => setField("plannedDate", value)}
        onStartTime={(value) => setField("startTime", value)}
        plannedDate={form.plannedDate}
        startTime={form.startTime}
      />
      <PlanEditorOutfitField
        onOutfitId={(value) => setField("outfitId", value)}
        outfitId={form.outfitId}
        outfits={outfits}
      />
      <PlanEditorOccasionFields
        eventTitle={form.eventTitle}
        occasion={form.occasion}
        onEventTitle={(value) => setField("eventTitle", value)}
        onOccasion={(value) => setField("occasion", value)}
      />
      <PlanEditorLocationStatusFields
        locationName={form.locationName}
        onLocationName={(value) => setField("locationName", value)}
        onStatus={(value) => setField("status", value)}
        plan={plan}
        status={form.status}
      />
    </>
  );
}
