import { SettingsManager } from "@/features/settings/components/SettingsManager";
import { isSupabaseConfigured } from "@/lib/env/client";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsManager configured={isSupabaseConfigured()} />;
}
