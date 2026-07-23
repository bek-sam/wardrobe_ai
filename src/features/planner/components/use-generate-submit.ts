import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { requestJson } from "@/lib/api/request";

import { parseGenerateResponse } from "./parse-generate-response";
import type { GenerateDay } from "./planner.types";

export function useGenerateSubmit(days: GenerateDay[], onGenerated: (message: string) => void) {
  const [location, setLocation] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = days.filter((day) => day.selected);
    if (!selected.length) {
      setError("Select at least one day to plan.");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setError(null);
    try {
      const result = await requestJson<unknown>("/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({
          days: selected.map((day) => ({
            date: day.date,
            occasion: day.occasion.trim() || null,
            location: location.trim() || null,
          })),
          save: true,
        }),
        signal: controller.signal,
      });
      onGenerated(parseGenerateResponse(result));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The week could not be generated.");
    } finally {
      controllerRef.current = null;
      setGenerating(false);
    }
  }

  return { location, setLocation, generating, error, submit };
}
