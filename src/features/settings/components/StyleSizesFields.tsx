import { SizesFieldset } from "./SizesFieldset";
import { StyleNotesFields } from "./StyleNotesFields";
import { StylePreferenceFields } from "./StylePreferenceFields";
import type { StyleFormState } from "./settings.types";

export function StyleSizesFields({
  disabled,
  form,
  setForm,
  onToggleStyle,
  onToggleActivity,
}: {
  disabled: boolean;
  form: StyleFormState;
  setForm: (updater: (current: StyleFormState) => StyleFormState) => void;
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
}) {
  function set<Key extends keyof StyleFormState>(key: Key, value: StyleFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <StylePreferenceFields
        disabled={disabled}
        form={form}
        onToggleActivity={onToggleActivity}
        onToggleStyle={onToggleStyle}
        set={set}
      />
      <SizesFieldset
        disabled={disabled}
        onChange={(key, value) => set(key, value)}
        sizes={{
          topSize: form.topSize,
          bottomSize: form.bottomSize,
          dressSize: form.dressSize,
          shoeSize: form.shoeSize,
        }}
      />
      <StyleNotesFields
        coverageNotes={form.coverageNotes}
        disabled={disabled}
        onCoverageNotes={(value) => set("coverageNotes", value)}
        onStyleNote={(value) => set("styleNote", value)}
        styleNote={form.styleNote}
      />
    </>
  );
}
