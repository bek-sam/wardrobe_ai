"use client";

import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

import { scrollTo } from "./settings-helpers";
import { SettingsContent } from "./SettingsContent";
import { SettingsStatus } from "./SettingsStatus";
import { SettingsTabs } from "./SettingsTabs";
import { useSettingsManagerState } from "./use-settings-manager-state";

export function SettingsManager({ configured }: { configured: boolean }) {
  const state = useSettingsManagerState(configured);

  return (
    <div className="page-stack settings-page">
      <PageHeader
        eyebrow="Your account"
        title="Settings"
        description="Control the context, preferences, and privacy choices Wardrobe AI can use."
      />
      {!configured ? (
        <DemoNotice>
          Preview mode: configure Supabase to load and securely save account settings. All controls
          below are disabled.
        </DemoNotice>
      ) : null}
      <SettingsStatus
        loading={state.loading}
        notice={state.notice}
        onRetry={() => state.setRetry((value) => value + 1)}
      />
      <div className="settings-layout">
        <SettingsTabs
          activeSection={state.activeSection}
          onOpen={(sectionId) => {
            state.setActiveSection(sectionId);
            scrollTo(sectionId);
          }}
        />
        <SettingsContent state={state} />
      </div>
    </div>
  );
}
