import { TextField } from "@/components/ui/FormField";

import { LocaleSelectField } from "./LocaleSelectField";
import type { ProfileFormState } from "./settings.types";

export function ProfileFields({
  disabled,
  form,
  setForm,
}: {
  disabled: boolean;
  form: ProfileFormState;
  setForm: (updater: (current: ProfileFormState) => ProfileFormState) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <TextField
        disabled={disabled}
        id="settings-first-name"
        label="First name"
        maxLength={100}
        onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
        placeholder="Your first name"
        value={form.firstName}
      />
      <TextField
        disabled={disabled}
        id="settings-display-name"
        label="Display name"
        maxLength={160}
        onChange={(event) =>
          setForm((current) => ({ ...current, displayName: event.target.value }))
        }
        optional
        placeholder="How your name appears"
        value={form.displayName}
      />
      <TextField
        id="settings-email"
        label="Email address"
        placeholder="Managed by your secure sign-in"
        readOnly
        type="email"
      />
      <LocaleSelectField
        disabled={disabled}
        locale={form.locale}
        onLocale={(value) => setForm((current) => ({ ...current, locale: value }))}
      />
    </div>
  );
}
