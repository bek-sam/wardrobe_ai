export type Profile = {
  id: string;
  first_name: string | null;
  display_name: string | null;
  home_location_name: string | null;
  timezone: string;
  temperature_unit: "celsius" | "fahrenheit";
  locale: string;
  modeled_preview_consent: boolean;
  identity_reference_path: string | null;
};

export type SignedUpload = {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  requiredContentType: string;
  maximumFileSize: number;
};

export type StyleProfile = {
  style_keywords: string[];
  favorite_colors: string[];
  avoided_colors: string[];
  preferred_fits: string[];
  preferred_formality: number | null;
  runs_cold: boolean | null;
  runs_hot: boolean | null;
  modesty_preferences: Record<string, unknown>;
  size_profile: Record<string, unknown>;
  common_activities: string[];
  notes: string;
};

export type Notice = { tone: "error" | "success"; message: string };

export type PrivacySectionProps = {
  identityReferencePath: string | null;
  modeledPreviewConsent: boolean;
  previewConsentBusy: boolean;
  disabled: boolean;
  onToggleConsent: () => void;
  onUpload: (file: File) => void;
};

export type DataOwnershipSectionProps = {
  disabled: boolean;
  busy: string | null;
  onExport: () => void;
  deleteOpen: boolean;
  onOpenDelete: () => void;
  deletePhrase: string;
  onDeletePhrase: (value: string) => void;
  deletePassword: string;
  onDeletePassword: (value: string) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  /**
   * Whether the account actually has a password identity. Drives which
   * reauthentication the deletion form asks for — an "email claim" is not
   * evidence of a password, and Google-only accounts have no password to type.
   */
  hasPassword: boolean;
  onReauthenticate: () => void;
};

export type ProfileFormState = { firstName: string; displayName: string; locale: string };

export type StyleFormState = {
  styles: string[];
  activities: string[];
  favoriteColors: string;
  avoidedColors: string;
  preferredFits: string;
  topSize: string;
  bottomSize: string;
  dressSize: string;
  shoeSize: string;
  coverageNotes: string;
  formality: string;
  temperatureComfort: string;
  styleNote: string;
};

export type LocationFormState = {
  homeLocation: string;
  timezone: string;
  temperatureUnit: "celsius" | "fahrenheit";
};
