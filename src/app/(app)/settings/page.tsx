import { SettingsManager } from "@/features/settings/components";
import { getFrontendConfig } from "@/lib/backend/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const configured = (await getFrontendConfig()).databaseConfigured;
  return <SettingsManager configured={configured} />;
}
