export function StylingContextBasicFields({
  date,
  onDate,
  location,
  onLocation,
  occasion,
  onOccasion,
}: {
  date: string;
  onDate: (value: string) => void;
  location: string;
  onLocation: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
}) {
  return (
    <>
      <label>
        <span>Date</span>
        <input onChange={(event) => onDate(event.target.value)} required type="date" value={date} />
      </label>
      <label>
        <span>Location</span>
        <input
          maxLength={160}
          onChange={(event) => onLocation(event.target.value)}
          placeholder="Use home location"
          value={location}
        />
      </label>
      <label>
        <span>Occasion</span>
        <input
          maxLength={120}
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="Work, dinner, travel…"
          value={occasion}
        />
      </label>
    </>
  );
}
