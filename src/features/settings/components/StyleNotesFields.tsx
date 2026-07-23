import { TextareaField } from "@/components/ui/FormField";

export function StyleNotesFields({
  disabled,
  coverageNotes,
  onCoverageNotes,
  styleNote,
  onStyleNote,
}: {
  disabled: boolean;
  coverageNotes: string;
  onCoverageNotes: (value: string) => void;
  styleNote: string;
  onStyleNote: (value: string) => void;
}) {
  return (
    <>
      <TextareaField
        disabled={disabled}
        id="settings-coverage-notes"
        label="Coverage or modesty preferences"
        maxLength={1_000}
        onChange={(event) => onCoverageNotes(event.target.value)}
        optional
        placeholder="Only preferences you explicitly want the stylist to use."
        rows={3}
        value={coverageNotes}
      />
      <TextareaField
        disabled={disabled}
        id="settings-style-note"
        label="Anything else the stylist should respect"
        maxLength={2_000}
        onChange={(event) => onStyleNote(event.target.value)}
        optional
        placeholder="Coverage, sensory comfort, workplace dress code, or other preferences…"
        rows={4}
        value={styleNote}
      />
    </>
  );
}
