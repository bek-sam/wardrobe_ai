import { SelectField } from "@/components/ui/FormField";

export function LocaleSelectField({
  locale,
  onLocale,
  disabled,
}: {
  locale: string;
  onLocale: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <SelectField
      disabled={disabled}
      id="settings-locale"
      label="Language"
      onChange={(event) => onLocale(event.target.value)}
      value={locale}
    >
      {!["en-US", "en-GB"].includes(locale) ? <option value={locale}>{locale}</option> : null}
      <option value="en-US">English (US)</option>
      <option value="en-GB">English (UK)</option>
    </SelectField>
  );
}
