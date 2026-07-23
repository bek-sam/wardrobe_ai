"use client";

import { toggleSelection } from "@/features/settings/style-options-helpers";

import { OnboardingActivitySection } from "./OnboardingActivitySection";
import { OnboardingBasicsSection } from "./OnboardingBasicsSection";
import { OnboardingDemoNotice } from "./OnboardingDemoNotice";
import { OnboardingFormFooter } from "./OnboardingFormFooter";
import { OnboardingHeader } from "./OnboardingHeader";
import { OnboardingIntro } from "./OnboardingIntro";
import { OnboardingStyleSection } from "./OnboardingStyleSection";
import { useOnboardingForm } from "./use-onboarding-form";

export function OnboardingForm({ configured }: { configured: boolean }) {
  const form = useOnboardingForm(configured);
  const disabled = !configured || form.saving;

  return (
    <div className="onboarding-page">
      <OnboardingHeader />
      <main className="onboarding-main">
        <OnboardingIntro />
        <form className="onboarding-form" onSubmit={form.submit}>
          <OnboardingDemoNotice configured={configured} />
          <OnboardingBasicsSection
            disabled={disabled}
            firstName={form.firstName}
            homeLocation={form.homeLocation}
            onFirstName={form.setFirstName}
            onHomeLocation={form.setHomeLocation}
            onTemperature={form.setTemperature}
            onTimezone={form.setTimezone}
            temperature={form.temperature}
            timezone={form.timezone}
          />
          <OnboardingStyleSection
            disabled={disabled}
            onToggle={(value) => toggleSelection(value, form.styles, form.setStyles)}
            styles={form.styles}
          />
          <OnboardingActivitySection
            activities={form.activities}
            disabled={disabled}
            onToggle={(value) => toggleSelection(value, form.activities, form.setActivities)}
          />
          <OnboardingFormFooter disabled={disabled} message={form.message} saving={form.saving} />
        </form>
      </main>
    </div>
  );
}
