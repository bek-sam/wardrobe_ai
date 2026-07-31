"use client";

export type IndoorOutdoor = "indoor" | "outdoor" | "mixed" | null;

const SETTINGS = [
  { value: "indoor", label: "Indoors" },
  { value: "outdoor", label: "Outdoors" },
  { value: "mixed", label: "A bit of both" },
] as const;

/** "Not sure" is a first-class answer: missing context is not a constraint. */
export function ComposerSettingField({
  value,
  onChange,
}: {
  value: IndoorOutdoor;
  onChange: (next: IndoorOutdoor) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="studio-setting">Setting</label>
      </div>
      <select
        className="select-input"
        id="studio-setting"
        onChange={(event) => onChange((event.target.value || null) as IndoorOutdoor)}
        value={value ?? ""}
      >
        <option value="">Not sure</option>
        {SETTINGS.map((setting) => (
          <option key={setting.value} value={setting.value}>
            {setting.label}
          </option>
        ))}
      </select>
    </div>
  );
}
