import type { FormEvent } from "react";

import type { Profile, ProfileFormState } from "./settings.types";

export function useSaveProfile(
  profileForm: ProfileFormState,
  save: (key: string, path: string, body: Record<string, unknown>) => Promise<Profile | unknown>,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
) {
  return async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save("profile", "/api/profile", {
      first_name: profileForm.firstName.trim() || null,
      display_name: profileForm.displayName.trim() || null,
      locale: profileForm.locale,
    });
    if (result)
      setProfile((current) => (current ? { ...current, ...(result as Profile) } : current));
  };
}
