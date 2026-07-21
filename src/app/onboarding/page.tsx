import { OnboardingForm } from "@/features/auth/OnboardingForm";
import { isSupabaseConfigured } from "@/lib/env/client";

export const metadata = {
  title: "Set up your style profile",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingForm configured={isSupabaseConfigured()} />;
}
