export function OutfitOccasionSelect({
  occasion,
  onOccasion,
  occasions,
}: {
  occasion: string;
  onOccasion: (value: string) => void;
  occasions: string[];
}) {
  return (
    <select
      aria-label="Filter outfits by occasion"
      onChange={(event) => onOccasion(event.target.value)}
      value={occasion}
    >
      <option value="">All occasions</option>
      {occasions.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}
