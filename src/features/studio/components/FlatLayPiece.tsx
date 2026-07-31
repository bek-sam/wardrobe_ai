"use client";

import { Lock, LockOpen } from "@phosphor-icons/react";

import type { StudioVariantItem } from "../types";
import { ROLE_LABELS } from "./role-label.data";

type Props = {
  item: StudioVariantItem;
  cutoutUrl: string | undefined;
  locked: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
};

export function FlatLayPiece({ item, cutoutUrl, locked, selected, onSelect, onToggleLock }: Props) {
  return (
    <div className={`flat-lay__piece${selected ? " flat-lay__piece--selected" : ""}`}>
      <button
        className="flat-lay__figure"
        onClick={onSelect}
        type="button"
        aria-pressed={selected}
        aria-label={`${ROLE_LABELS[item.role]}: ${item.name}. Open details.`}
      >
        {cutoutUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL
          <img alt="" src={cutoutUrl} loading="lazy" />
        ) : (
          <span className="flat-lay__placeholder" aria-hidden="true">
            No cut-out yet
          </span>
        )}
      </button>
      <button
        className={`flat-lay__lock${locked ? " flat-lay__lock--on" : ""}`}
        onClick={onToggleLock}
        type="button"
        aria-pressed={locked}
        aria-label={locked ? `Unlock ${item.name}` : `Lock ${item.name}`}
      >
        {locked ? <Lock size={14} weight="fill" /> : <LockOpen size={14} />}
        <span>{locked ? "Locked" : "Lock"}</span>
      </button>
      <p className="flat-lay__caption">
        <span>{ROLE_LABELS[item.role]}</span>
        <strong>{item.name}</strong>
      </p>
    </div>
  );
}
