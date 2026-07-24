import { Sparkle } from "@phosphor-icons/react/ssr";

import { PreviewBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { TodayWorkspace } from "@/features/today/components/TodayWorkspace";
import { WeatherCard } from "@/features/weather/components/WeatherCard";
import { isSupabaseConfigured } from "@/lib/env/client";
import { getServerEnvironment } from "@/lib/env/server";

import { TodayContextCard } from "./TodayContextCard";
import { TodayLook } from "./TodayLook";
import { TodayRecentStrip } from "./TodayRecentStrip";

export const metadata = { title: "Today" };

export default function TodayPage() {
  if (isSupabaseConfigured()) {
    const environment = getServerEnvironment();
    return (
      <TodayWorkspace
        aiConfigured={Boolean(environment.OPENAI_API_KEY && environment.OPENAI_STYLIST_MODEL)}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Tuesday, July 21"
        title="Good morning."
        description="Let’s make getting dressed the easiest decision of your day."
        meta={<PreviewBadge />}
        actions={
          <ButtonLink href="/stylist">
            Ask your stylist <Sparkle aria-hidden="true" size={16} />
          </ButtonLink>
        }
      />
      <DemoNotice>
        The weather, occasion, and outfit below are illustrative until your profile and wardrobe are
        connected.
      </DemoNotice>
      <div className="today-grid">
        <WeatherCard />
        <TodayContextCard />
      </div>

      <TodayLook />
      <TodayRecentStrip />
    </div>
  );
}
