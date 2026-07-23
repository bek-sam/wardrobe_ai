import { ColorFitFields } from "./ColorFitFields";
import { FormalityTemperatureFields } from "./FormalityTemperatureFields";
import { StyleActivityFieldsets } from "./StyleActivityFieldsets";
import type { StyleFormState } from "./settings.types";

export function StylePreferenceFields({
  disabled,
  form,
  set,
  onToggleStyle,
  onToggleActivity,
}: {
  disabled: boolean;
  form: StyleFormState;
  set: <Key extends keyof StyleFormState>(key: Key, value: StyleFormState[Key]) => void;
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
}) {
  return (
    <>
      <StyleActivityFieldsets
        activities={form.activities}
        disabled={disabled}
        onToggleActivity={onToggleActivity}
        onToggleStyle={onToggleStyle}
        styles={form.styles}
      />
      <FormalityTemperatureFields
        disabled={disabled}
        formality={form.formality}
        onFormality={(value) => set("formality", value)}
        onTemperatureComfort={(value) => set("temperatureComfort", value)}
        temperatureComfort={form.temperatureComfort}
      />
      <ColorFitFields
        avoidedColors={form.avoidedColors}
        disabled={disabled}
        favoriteColors={form.favoriteColors}
        onAvoidedColors={(value) => set("avoidedColors", value)}
        onFavoriteColors={(value) => set("favoriteColors", value)}
        onPreferredFits={(value) => set("preferredFits", value)}
        preferredFits={form.preferredFits}
      />
    </>
  );
}
