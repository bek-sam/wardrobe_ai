export function UploadHintField({
  userHint,
  onChange,
}: {
  userHint: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field import-hint-field">
      <span>Optional note for detection</span>
      <input
        className="text-input"
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Example: the scarf belongs to this outfit too"
        value={userHint}
      />
    </label>
  );
}
