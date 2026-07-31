"use client";

import { ComposerSettingField } from "./ComposerSettingField";
import type { ComposerState } from "./use-composer";

export function ComposerContextFields({ composer }: { composer: ComposerState }) {
  return (
    <div className="form-grid form-grid--two">
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="studio-date">Date</label>
        </div>
        <input
          className="text-input"
          id="studio-date"
          onChange={(event) => composer.setDate(event.target.value)}
          type="date"
          value={composer.date}
        />
      </div>
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="studio-location">Where</label>
          <span>Optional</span>
        </div>
        <input
          className="text-input"
          id="studio-location"
          onChange={(event) => composer.setLocation(event.target.value)}
          placeholder="Uses your saved location"
          value={composer.location}
        />
      </div>
      <ComposerSettingField onChange={composer.setIndoorOutdoor} value={composer.indoorOutdoor} />
    </div>
  );
}
