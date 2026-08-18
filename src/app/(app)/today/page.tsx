import { Sparkle } from "@phosphor-icons/react/ssr";

import { PreviewBadge } from "@/components/ui";
import { ButtonLink } from "@/components/ui";
import { DemoNotice } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { TodayWorkspace } from "@/features/today/components";
import { getFrontendConfig } from "@/lib/backend/server";
import { Badge } from "@/components/ui";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { Card } from "@/components/ui";
import { Check, CloudRain, Heart, Shuffle } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { SectionHeader } from "@/components/ui";
import { previewItems } from "../preview-data";
import { MapPin, Wind } from "@phosphor-icons/react/ssr";

function WeatherCard({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`weather-card${compact ? " weather-card--compact" : ""}`}
      aria-labelledby="weather-title"
    >
      <div className="weather-card__topline">
        <span>
          <MapPin size={14} aria-hidden="true" /> Chicago
        </span>
        <Badge tone="outline">Forecast preview</Badge>
      </div>
      <div className="weather-card__forecast">
        <CloudRain size={compact ? 34 : 48} weight="duotone" aria-hidden="true" />
        <div>
          <strong>62°</strong>
          <span>Feels like 59°</span>
        </div>
      </div>
      <div className="weather-card__copy">
        <h2 id="weather-title">Cool with light rain</h2>
        <p>A breathable layer and rain-safe shoes will carry you through the day.</p>
      </div>
      <div className="weather-card__facts">
        <span>
          <CloudRain size={15} /> 48% rain
        </span>
        <span>
          <Wind size={15} /> 12 mph
        </span>
      </div>
    </section>
  );
}

function TodayRecentStrip() {
  return (
    <section>
      <SectionHeader
        title="Recently added"
        description="A quick way back to the pieces you are still getting to know."
        action={
          <ButtonLink href="/wardrobe" variant="ghost">
            View wardrobe <ArrowRight size={15} />
          </ButtonLink>
        }
      />
      <div className="recent-strip">
        {previewItems.slice(0, 4).map((item) => (
          <article key={item.id}>
            <GarmentArtwork
              compact
              category={item.category}
              color={item.color}
              accent={item.accent}
            />
            <div>
              <span>{item.categoryLabel}</span>
              <strong>{item.name}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TodayLookDetails() {
  return (
    <div className="today-look__details">
      <p className="eyebrow">Office · 62° · light rain</p>
      <h2 id="today-look-title">Workday ease</h2>
      <p className="today-look__summary">
        The camel layer adds warmth without bulk, while the navy trouser keeps the relaxed shirt
        appropriate for work.
      </p>
      <ul className="today-look__reasons">
        <li>
          <Check size={15} weight="bold" /> Light outer layer for the cooler morning
        </li>
        <li>
          <CloudRain size={15} /> Leather shoes handle light rain better
        </li>
        <li>
          <Check size={15} weight="bold" /> No unavailable pieces selected
        </li>
      </ul>
      <div className="today-look__actions">
        <Button>
          <Heart size={16} /> Save look
        </Button>
        <Button variant="secondary">
          <Shuffle size={16} /> Swap a piece
        </Button>
      </div>
      <div className="today-look__alternatives">
        <span>Make it</span>
        <button type="button">More casual</button>
        <button type="button">Warmer</button>
        <button type="button">Different shoes</button>
      </div>
    </div>
  );
}

function TodayContextCard() {
  return (
    <Card className="context-card" as="section">
      <div className="context-card__icon">
        <CalendarBlank size={22} weight="light" />
      </div>
      <div>
        <p className="eyebrow">Today’s context</p>
        <h2>What are you dressing for?</h2>
        <p>Add an occasion so the recommendation can match your day.</p>
      </div>
      <div className="context-card__choices">
        <button type="button">Work</button>
        <button type="button">Casual day</button>
        <button type="button">Dinner</button>
        <button type="button">Add context</button>
      </div>
    </Card>
  );
}

function TodayLookArt() {
  return (
    <div className="today-look__art">
      <div className="today-look__label">
        <Badge tone="rust">Recommended preview</Badge>
      </div>
      <div className="today-look__pieces">
        <GarmentArtwork category="top" color="#ddd4c2" accent="#766e61" />
        <GarmentArtwork category="bottom" color="#293647" />
        <GarmentArtwork category="layer" color="#9c7250" />
        <GarmentArtwork category="shoes" color="#292724" />
      </div>
    </div>
  );
}

function TodayLook() {
  return (
    <section className="today-look" aria-labelledby="today-look-title">
      <TodayLookArt />
      <TodayLookDetails />
    </section>
  );
}

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const config = await getFrontendConfig();
  if (config.databaseConfigured) {
    return <TodayWorkspace aiConfigured={config.capabilities.outfitGenerationAvailable} />;
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
