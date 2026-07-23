export function StylingContextSelectFields({
  indoorOutdoor,
  onIndoorOutdoor,
  targetFormality,
  onTargetFormality,
}: {
  indoorOutdoor: string;
  onIndoorOutdoor: (value: string) => void;
  targetFormality: string;
  onTargetFormality: (value: string) => void;
}) {
  return (
    <>
      <label>
        <span>Setting</span>
        <select onChange={(event) => onIndoorOutdoor(event.target.value)} value={indoorOutdoor}>
          <option value="">Not specified</option>
          <option value="indoor">Mostly indoors</option>
          <option value="outdoor">Mostly outdoors</option>
          <option value="mixed">Mixed</option>
        </select>
      </label>
      <label>
        <span>Formality</span>
        <select onChange={(event) => onTargetFormality(event.target.value)} value={targetFormality}>
          <option value="">Use my preference</option>
          <option value="1">Very casual</option>
          <option value="2">Casual</option>
          <option value="3">Smart casual</option>
          <option value="4">Formal</option>
          <option value="5">Very formal</option>
        </select>
      </label>
    </>
  );
}
