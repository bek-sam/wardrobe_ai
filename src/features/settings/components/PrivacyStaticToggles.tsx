const STATIC_TOGGLES: Array<[string, string]> = [
  ["Allow product research", "Research runs only when requested and always shows sources."],
  ["Preference learning", "Editable learned-preference controls are planned for a later release."],
];

export function PrivacyStaticToggles() {
  return (
    <>
      {STATIC_TOGGLES.map(([label, description]) => (
        <label className="toggle-row" key={label}>
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
          <input disabled role="switch" type="checkbox" />
        </label>
      ))}
    </>
  );
}
