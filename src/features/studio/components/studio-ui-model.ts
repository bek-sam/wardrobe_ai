"use client";

import type { StudioGarmentDetail, StudioVariantItem } from "../types";
import type { OutfitItemRole } from "@/features/outfits";
import type { OutfitVariantMode } from "../types";
import { useState } from "react";
import type { StudioRequestInput } from "../api";
import { useCallback } from "react";
import {
  pointToNormalized,
  resolveHotspotHit,
  type GarmentHotspot,
  type Size,
} from "@/lib/visualization";

export const OCCASION_CHIPS = [
  "Work",
  "Casual day",
  "Dinner out",
  "Date night",
  "Wedding guest",
  "Travel day",
  "Errands",
  "Something formal",
] as const;

/**
 * Vibes are appended to the natural-language request rather than becoming a
 * hard constraint: they steer the stylist's phrasing and preference weighting
 * without ever overriding weather, dress code, or availability.
 */
export const VIBE_CHIPS = [
  "polished",
  "relaxed",
  "minimal",
  "playful",
  "romantic",
  "creative",
  "sharp",
  "cozy",
] as const;

export const SURPRISE_ME_REQUEST =
  "Surprise me with something that suits today's weather and what I usually like wearing.";

/**
 * Adapts the flat lay's variant items into the same shape the try-on garment
 * chips use, so one chip list and one detail sheet serve both stages rather
 * than two parallel implementations that can drift apart.
 */
export function flatLayGarments(items: readonly StudioVariantItem[]): StudioGarmentDetail[] {
  return items.map((item) => ({
    itemId: item.itemId,
    role: item.role,
    sortOrder: item.sortOrder,
    hotspot: null,
    available: item.availabilityStatus === "available",
    item: {
      name: item.name,
      category: item.category,
      color_names: item.colorNames,
      pattern: item.pattern,
      availability_status: item.availabilityStatus,
      favorite: item.favorite,
      wear_count: item.wearCount,
    },
    cutoutUrl: null,
  }));
}

export const PHOTO_GUIDANCE = [
  "One person, and only you.",
  "Full body, head through shoes.",
  "Facing the camera, or turned very slightly.",
  "Arms a little away from your torso.",
  "Even, natural light.",
  "Nothing covering you — no bags, no furniture in front.",
  "Plain, close-fitting clothes if you're comfortable in them.",
  "No mirrors with other people reflected.",
] as const;

/**
 * Deliberately concrete about what happens to the photo. Consent that does not
 * say where the image goes is not informed consent.
 */
export const CONSENT_POINTS = [
  "Your photo is stored privately, in a bucket only you can read.",
  "It is sent to a third-party AI image service to render each try-on you ask for.",
  "It is used only when you press Try it on. Nothing is generated in the background.",
  "You can replace or delete it at any time, which also removes the try-ons made from it.",
] as const;

export const CONSENT_STATEMENT =
  "I understand my reference photo will be sent to a third-party AI image service to generate private style visualizations, and that these are visualizations rather than predictions of fit.";

export const ROLE_LABELS: Record<OutfitItemRole, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  layer: "Layer",
  shoes: "Shoes",
  accessory: "Accessory",
};

export const MODE_LABELS: Record<OutfitVariantMode, string> = {
  safe: "Safe",
  fresh: "Fresh",
  statement: "Statement",
};

export const MODE_DESCRIPTIONS: Record<OutfitVariantMode, string> = {
  safe: "Familiar and dependable",
  fresh: "A balanced change of pace",
  statement: "The most expressive of the three",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Ready to wear",
  laundry: "In the laundry",
  packed: "Packed away",
  loaned: "Loaned out",
  repair: "Being repaired",
};

export type ComposerState = ReturnType<typeof useComposer>;

/**
 * Nothing here is required. A bare natural-language sentence, or even just
 * "Surprise me", is a complete request — the server fills the rest from stored
 * preferences and the forecast.
 */
export function useComposer(initialDate: string) {
  const [message, setMessage] = useState("");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState("");
  const [indoorOutdoor, setIndoorOutdoor] = useState<"indoor" | "outdoor" | "mixed" | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);

  const toggleVibe = (vibe: string) =>
    setVibes((previous) =>
      previous.includes(vibe) ? previous.filter((entry) => entry !== vibe) : [...previous, vibe],
    );

  const buildInput = (surprise = false, lockedItemIds: string[] = []): StudioRequestInput => {
    const base = surprise ? SURPRISE_ME_REQUEST : message.trim();
    const vibeSuffix = vibes.length ? ` Aim for something ${vibes.join(", ")}.` : "";
    return {
      message: `${base || SURPRISE_ME_REQUEST}${vibeSuffix}`.slice(0, 2_000),
      date,
      location: location.trim() || null,
      occasion,
      indoorOutdoor,
      lockedItemIds,
    };
  };

  return {
    message,
    setMessage,
    occasion,
    setOccasion,
    date,
    setDate,
    location,
    setLocation,
    indoorOutdoor,
    setIndoorOutdoor,
    vibes,
    toggleVibe,
    buildInput,
  };
}

type Options = {
  hotspots: readonly GarmentHotspot[];
  natural: Size | null;
  container: Size | null;
  onSelect: (itemId: string) => void;
  onAmbiguous: (hotspots: GarmentHotspot[]) => void;
};

/**
 * Maps a click on the displayed image back to a garment. A click in the
 * letterbox bars resolves to nothing rather than to the nearest region, and
 * two comparably sized overlapping layers open the chooser instead of the
 * component guessing which one the user meant.
 */
export function useHotspotPointer({
  hotspots,
  natural,
  container,
  onSelect,
  onAmbiguous,
}: Options) {
  return useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!natural || !container) return;
      const box = event.currentTarget.getBoundingClientRect();
      const point = pointToNormalized(
        { x: event.clientX - box.left, y: event.clientY - box.top },
        natural,
        container,
      );
      if (!point) return;

      const hit = resolveHotspotHit(hotspots, point);
      if (hit.kind === "single") onSelect(hit.hotspot.itemId);
      else if (hit.kind === "ambiguous") onAmbiguous(hit.hotspots);
    },
    [hotspots, natural, container, onSelect, onAmbiguous],
  );
}

/**
 * Hit-testing and the ambiguity chooser. Deliberately holds no ref: the
 * container ref stays in the component so this object can be destructured
 * freely without dragging a ref through render.
 */
export function useInteractiveImage(
  garments: readonly StudioGarmentDetail[],
  natural: Size | null,
  container: Size | null,
  onSelect: (itemId: string) => void,
) {
  const [ambiguous, setAmbiguous] = useState<GarmentHotspot[] | null>(null);
  const hotspots = garments.flatMap((garment) => (garment.hotspot ? [garment.hotspot] : []));

  const choose = (itemId: string) => {
    setAmbiguous(null);
    onSelect(itemId);
  };
  const onPointer = useHotspotPointer({
    hotspots,
    natural,
    container,
    onSelect: choose,
    onAmbiguous: setAmbiguous,
  });

  return {
    hotspots,
    ambiguous,
    choose,
    onPointer,
    dismissChooser: () => setAmbiguous(null),
    nameFor: (itemId: string) =>
      (garments.find((garment) => garment.itemId === itemId)?.item?.name as string) ?? "this piece",
  };
}
