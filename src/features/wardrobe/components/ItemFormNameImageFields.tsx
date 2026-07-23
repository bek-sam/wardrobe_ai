export function ItemFormNameImageFields({
  name,
  onName,
  onImage,
}: {
  name: string;
  onName: (value: string) => void;
  onImage: (file: File | null) => void;
}) {
  return (
    <>
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="item-name">Name</label>
          <span>Required</span>
        </div>
        <input
          autoFocus
          className="text-input"
          id="item-name"
          maxLength={160}
          onChange={(event) => onName(event.target.value)}
          required
          value={name}
        />
      </div>
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="item-image">Garment image</label>
          <span>Optional · JPEG, PNG, or WebP · 4 MB max</span>
        </div>
        <input
          accept="image/jpeg,image/png,image/webp"
          id="item-image"
          onChange={(event) => onImage(event.target.files?.[0] ?? null)}
          type="file"
        />
      </div>
    </>
  );
}
