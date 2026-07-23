import { User } from "@phosphor-icons/react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { ProfileFields } from "./ProfileFields";
import type { ProfileFormState } from "./settings.types";

export function ProfileSection({
  disabled,
  busy,
  form,
  setForm,
  onSubmit,
}: {
  disabled: boolean;
  busy: string | null;
  form: ProfileFormState;
  setForm: (updater: (current: ProfileFormState) => ProfileFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card as="section" className="settings-section" id="settings-profile">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Your details</h2>
          <p>Used for greetings and account communication—not style inference.</p>
        </div>
        <span className="settings-avatar" aria-hidden="true">
          <User size={26} weight="light" />
        </span>
      </div>
      <form onSubmit={onSubmit}>
        <ProfileFields disabled={disabled} form={form} setForm={setForm} />
        <div className="settings-form-actions">
          <Button disabled={disabled} type="submit">
            {busy === "profile" ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
