"use client";

import { Warning } from "@phosphor-icons/react";

import type { StudioVariant } from "../types";
import { MODE_LABELS } from "./role-label.data";

/**
 * Reasons and warnings only. Deliberately shows no score or percentage: an
 * internal ranking number presented as a consumer certainty reads as a promise
 * the system cannot keep.
 */
export function OutfitWhyPanel({ variant }: { variant: StudioVariant }) {
  return (
    <section className="why-panel">
      <p className="eyebrow">{MODE_LABELS[variant.mode]}</p>
      <h2 className="why-panel__title">{variant.title}</h2>
      {variant.stylistNote ? <p className="why-panel__note">{variant.stylistNote}</p> : null}

      {variant.reasons.length > 0 ? (
        <ul className="why-panel__reasons">
          {variant.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {variant.warnings.length > 0 ? (
        <ul className="why-panel__warnings">
          {variant.warnings.map((warning) => (
            <li key={warning}>
              <Warning aria-hidden="true" size={14} />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {variant.styleTags.length > 0 ? (
        <p className="why-panel__tags">
          {variant.styleTags.map((tag) => (
            <span className="badge badge--outline" key={tag}>
              {tag}
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
