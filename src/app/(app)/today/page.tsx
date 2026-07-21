import {
  ArrowRight,
  CalendarBlank,
  Check,
  CloudRain,
  Heart,
  Shuffle,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import { Badge, PreviewBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { TodayWorkspace } from "@/features/today/components/TodayWorkspace";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { WeatherCard } from "@/features/weather/components/WeatherCard";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import { isSupabaseConfigured } from "@/lib/env/client";
import { getServerEnvironment } from "@/lib/env/server";
import { previewItems } from "../preview-data";

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
      </div>

      <section className="today-look" aria-labelledby="today-look-title">
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
      </section>

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
    </div>
  );
}
