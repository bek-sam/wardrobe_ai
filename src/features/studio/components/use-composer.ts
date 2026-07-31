"use client";

import { useState } from "react";

import type { StudioRequestInput } from "../api/studio-client";
import { SURPRISE_ME_REQUEST } from "./composer-options.data";

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
