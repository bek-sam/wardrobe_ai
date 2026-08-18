/**
 * The strict, allow-listed shape of everything the Settings security area may
 * learn about an account.
 *
 * Written as an explicit type rather than "whatever Supabase returned" on
 * purpose. The provider's `User` object carries `app_metadata`,
 * `user_metadata`, and per-identity provider payloads — hosted-domain hints,
 * avatar URLs, provider subject ids — none of which the browser needs and all
 * of which would end up in a page bundle, a screenshot, or a bug report.
 *
 * Never present here: access or refresh tokens, provider tokens, TOTP secrets,
 * password hashes, or raw identity payloads.
 */
export type AccountSecurityFactor = {
  id: string;
  friendlyName: string | null;
  createdAt: string | null;
};

export type AccountSecurityIdentity = {
  identityId: string;
  provider: string;
  label: string;
  recoveryCapable: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export type AccountSecurity = {
  userId: string;
  email: string | null;
  emailConfirmed: boolean;
  emailConfirmedAt: string | null;
  /** Set while a double-confirmation email change is in flight. */
  pendingEmail: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  identities: AccountSecurityIdentity[];
  hasPassword: boolean;
  mfaEnabled: boolean;
  factors: AccountSecurityFactor[];
  assuranceLevel: string | null;
  /**
   * How *this* session authenticated, from the token's `amr` claim — e.g.
   * `["password", "totp"]`. Distinct from `identities`, which lists every
   * method the account could use. Method names only; the claim's timestamps
   * are deliberately not forwarded.
   */
  currentAuthenticationMethods: string[];
  /** Which optional sign-in methods this deployment actually offers. */
  googleAuthEnabled: boolean;
  magicLinkEnabled: boolean;
};

export function optionValue(option: string) {
  return option.toLowerCase().replaceAll(" ", "-");
}

export function toggleSelection(
  value: string,
  selected: string[],
  setSelected: (values: string[]) => void,
) {
  setSelected(
    selected.includes(value)
      ? selected.filter((candidate) => candidate !== value)
      : [...selected, value],
  );
}

export const styleOptions = [
  "Minimal",
  "Classic",
  "Smart casual",
  "Comfort-first",
  "Colorful",
  "Streetwear",
  "Athletic",
  "Modest",
];

export const activityOptions = [
  "Work",
  "School",
  "Dinner",
  "Outdoors",
  "Travel",
  "Events",
  "Worship",
  "Gym",
];

export const timezoneOptions = [
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
];
