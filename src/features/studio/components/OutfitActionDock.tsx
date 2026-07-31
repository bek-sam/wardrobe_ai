"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  mode: "flat-lay" | "try-on";
  canVisualize: boolean;
  busy: boolean;
  saved: boolean;
  hasLocks: boolean;
  onSave: () => void;
  onWearToday: () => void;
  onPlan: () => void;
  onTryOn: () => void;
  onRemix: () => void;
};

/**
 * Sticky on mobile, inline on desktop. Every control keeps a visible text
 * label — an icon-only primary action fails the 44×44 target guidance and
 * gives a screen reader nothing useful to announce.
 */
export function OutfitActionDock(props: Props) {
  return (
    <div className="action-dock">
      <Button disabled={props.busy || !props.canVisualize} onClick={props.onTryOn}>
        {props.mode === "try-on" ? "Update try-on" : "Try it on"}
      </Button>
      <Button disabled={props.busy} onClick={props.onSave} variant="secondary">
        {props.saved ? "Saved" : "Save look"}
      </Button>
      <Button disabled={props.busy || !props.saved} onClick={props.onWearToday} variant="ghost">
        Wear today
      </Button>
      <Button disabled={props.busy || !props.saved} onClick={props.onPlan} variant="ghost">
        Plan for a date
      </Button>
      <Button disabled={props.busy} onClick={props.onRemix} variant="ghost">
        {props.hasLocks ? "Remix the rest" : "Remix"}
      </Button>
    </div>
  );
}
