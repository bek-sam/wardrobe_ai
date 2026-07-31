"use client";

export function ComposerRequestField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="studio-request">Where are you going?</label>
        <span>Optional</span>
      </div>
      <textarea
        className="textarea-input"
        id="studio-request"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Dinner with friends after work, somewhere a bit smart"
        value={value}
      />
      <p className="form-field__hint">
        Plain language works. Anything you leave out is filled in from your preferences and the
        forecast.
      </p>
    </div>
  );
}
