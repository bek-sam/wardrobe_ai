import type { FormEvent } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { StyleSizesFields } from "./StyleSizesFields";
import type { StyleFormState } from "./settings.types";

export function StyleSizesSection({
  disabled,
  busy,
  form,
  setForm,
  onToggleStyle,
  onToggleActivity,
  onSubmit,
}: {
  disabled: boolean;
  busy: string | null;
  form: StyleFormState;
  setForm: (updater: (current: StyleFormState) => StyleFormState) => void;
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card as="section" className="settings-section" id="settings-style">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Style profile</p>
          <h2>How you like to dress</h2>
          <p>Explicit preferences take priority over inferred patterns.</p>
        </div>
        <Badge tone="outline">Optional</Badge>
      </div>
      <form onSubmit={onSubmit}>
        <StyleSizesFields
          disabled={disabled}
          form={form}
          onToggleActivity={onToggleActivity}
          onToggleStyle={onToggleStyle}
          setForm={setForm}
        />
        <div className="settings-form-actions">
          <Button disabled={disabled} type="submit">
            {busy === "style" ? "Saving…" : "Save style profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
