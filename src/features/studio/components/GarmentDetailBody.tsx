"use client";

import { garmentFacts, hasLowConfidenceMetadata } from "./garment-facts";
import { ROLE_LABELS } from "./role-label.data";
import type { StudioGarmentDetail } from "../types";

export function GarmentDetailBody({ garment }: { garment: StudioGarmentDetail }) {
  const facts = garmentFacts(garment.item);

  return (
    <>
      <div className="garment-detail__head">
        {garment.cutoutUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL
          <img alt="" className="garment-detail__cutout" src={garment.cutoutUrl} />
        ) : null}
        <div>
          <p className="garment-detail__role">{ROLE_LABELS[garment.role]}</p>
          <h3 className="garment-detail__name">
            {(garment.item?.name as string) ?? "This piece is no longer in your wardrobe"}
          </h3>
        </div>
      </div>

      {!garment.available ? (
        <p className="inline-feedback inline-feedback--error">
          <span>This piece is no longer active in your wardrobe.</span>
        </p>
      ) : null}

      {facts.length > 0 ? (
        <dl className="garment-detail__facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasLowConfidenceMetadata(garment.item) ? (
        <p className="garment-detail__confidence">
          Some details for this piece were suggested automatically and are not confirmed yet.
        </p>
      ) : null}
    </>
  );
}
