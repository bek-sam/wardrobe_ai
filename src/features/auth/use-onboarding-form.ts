import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { submitOnboarding } from "./submit-onboarding";

export function useOnboardingForm(configured: boolean) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [homeLocation, setHomeLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [temperature, setTemperature] = useState("neutral");
  const [styles, setStyles] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const values = { firstName, homeLocation, timezone, temperature, styles, activities };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await submitOnboarding(values);
      router.push("/wardrobe/import");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your choices could not be saved.");
      setSaving(false);
    }
  }

  return {
    firstName,
    setFirstName,
    homeLocation,
    setHomeLocation,
    timezone,
    setTimezone,
    temperature,
    setTemperature,
    styles,
    setStyles,
    activities,
    setActivities,
    saving,
    message,
    submit,
  };
}
