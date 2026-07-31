"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

import { CONSENT_POINTS, CONSENT_STATEMENT } from "./photo-guidance.data";

type Props = {
  previewUrl: string | null;
  assessmentMessage: string | null;
  busy: boolean;
  onActivate: () => void;
};

/**
 * The user reviews the *normalized* photo — the one that will actually be
 * sent — and must tick an explicit box. A link or an implied acceptance is not
 * consent, so the activate button stays disabled until the box is checked.
 */
export function IdentityConsentStep({ previewUrl, assessmentMessage, busy, onActivate }: Props) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="identity-step">
      <h3>Review and turn on AI try-on</h3>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL
        <img alt="Your reference photo" className="identity-step__preview" src={previewUrl} />
      ) : null}
      {assessmentMessage ? <p className="identity-step__note">{assessmentMessage}</p> : null}
      <ul className="identity-step__guidance">
        {CONSENT_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <label className="check-row">
        <input
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          type="checkbox"
        />
        <span>{CONSENT_STATEMENT}</span>
      </label>
      <Button disabled={!accepted || busy} onClick={onActivate}>
        {busy ? "Turning on…" : "Turn on AI try-on"}
      </Button>
    </div>
  );
}
