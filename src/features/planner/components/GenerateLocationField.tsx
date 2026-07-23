export function GenerateLocationField({
  location,
  onLocation,
}: {
  location: string;
  onLocation: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>Location override</span>
      <input
        className="text-input"
        maxLength={160}
        onChange={(event) => onLocation(event.target.value)}
        placeholder="Blank uses your home location"
        value={location}
      />
    </label>
  );
}
