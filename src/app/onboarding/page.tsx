import { OnboardingForm } from "@/features/auth/OnboardingForm";
import { getFrontendConfig } from "@/lib/backend/server";

export const metadata = {
  title: "Set up your style profile",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const config = await getFrontendConfig();
  return <OnboardingForm configured={config.databaseConfigured} />;
}
