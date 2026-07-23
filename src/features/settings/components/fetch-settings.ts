import { requestJson } from "@/lib/api/request";

import type { Profile, StyleProfile } from "./settings.types";

export async function fetchSettings(signal: AbortSignal) {
  const [profile, style] = await Promise.all([
    requestJson<Profile>("/api/profile", { signal }),
    requestJson<StyleProfile | null>("/api/style-profile", { signal }),
  ]);
  return { profile, style };
}
