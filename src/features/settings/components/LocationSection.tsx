import { MapPin } from "@phosphor-icons/react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { LocationFields } from "./LocationFields";
import type { LocationFormState } from "./settings.types";

export function LocationSection({
  disabled,
  busy,
  form,
  setForm,
  onSubmit,
}: {
  disabled: boolean;
  busy: string | null;
  form: LocationFormState;
  setForm: (updater: (current: LocationFormState) => LocationFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card as="section" className="settings-section" id="settings-location">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Weather context</p>
          <h2>Location & units</h2>
          <p>Used only to retrieve weather for the dates and places you request.</p>
        </div>
        <MapPin size={22} />
      </div>
      <form onSubmit={onSubmit}>
        <LocationFields disabled={disabled} form={form} setForm={setForm} />
        <div className="settings-form-actions">
          <Button disabled={disabled} type="submit">
            {busy === "location" ? "Saving…" : "Save location settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
